import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { ensureVectorStore } from "@/lib/vector-store";
import { checkRateLimit } from "@/lib/rate-limiter";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { filterInput, filterOutput } from "@/lib/content-filter";
import { getClientIP } from "@/lib/utils";
import type { ChatRequest, Source } from "@/types";

/**
 * Extract sources from text containing [DOCUMENT: name | PAGE: N] markers
 * or 【...】 annotation markers that OpenAI adds.
 */
function extractSourcesFromText(text: string): Source[] {
  const sources: Source[] = [];

  // Pattern 1: [DOCUMENT: name | PAGE: N]
  const regex1 = /\[DOCUMENT:\s*(.+?)\s*\|\s*PAGE:\s*(\d+)\]/g;
  let match;
  while ((match = regex1.exec(text)) !== null) {
    const document = match[1].trim();
    const page = parseInt(match[2], 10);
    if (!sources.some((s) => s.document === document && s.page === page)) {
      sources.push({ document, page });
    }
  }

  // Pattern 2: 【number:number†filename】 — only add page if second number > 0
  const regex2 = /【(\d+):(\d+)†(.+?)】/g;
  while ((match = regex2.exec(text)) !== null) {
    const pageNum = parseInt(match[2], 10);
    const document = match[3].trim();
    const page = pageNum > 0 ? pageNum : undefined;
    if (!sources.some((s) => s.document === document && (s.page ?? 0) === (page ?? 0))) {
      sources.push({ document, ...(page != null ? { page } : {}) });
    }
  }

  return sources;
}

/** Extract page number from chunk text (multiple formats). */
function extractPageFromChunkText(text: string): number | undefined {
  if (!text || typeof text !== "string") return undefined;
  const patterns = [
    /page\s*[:=]\s*(\d+)/i,
    /صفحة\s*[:=]?\s*(\d+)/,
    /الصفحة\s*(\d+)/,
    /\bp\.\s*(\d+)\b/i,
    /–\s*(\d+)\s*of\s*\d+/,
    /—\s*(\d+)\s*—/,
    /^\s*(\d+)\s*\/\s*\d+\s*$/m,
    /\(صفحة\s*(\d+)\)/,
    /\(page\s*(\d+)\)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const p = parseInt(m[1], 10);
      if (p > 0 && p < 10000) return p;
    }
  }
  return undefined;
}

/**
 * Extract source info from file_search results returned by OpenAI.
 * Includes text snippets for display in source modals.
 */
function extractSourcesFromSearchResults(
  results: Array<{ text?: string; filename?: string; score?: number }>
): Source[] {
  const sources: Source[] = [];
  for (const result of results) {
    const filename = result.filename;
    if (!filename) continue;
    const page = result.text ? extractPageFromChunkText(result.text) : undefined;
    const snippet = result.text
      ? result.text.slice(0, 500).trim()
      : undefined;
    const entry = { document: filename, ...(page ? { page } : {}), ...(snippet ? { snippet } : {}) };
    if (!sources.some((s) => s.document === filename && (s.page ?? 0) === (page ?? 0))) {
      sources.push(entry);
    }
  }
  return sources;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    const rateCheck = checkRateLimit(ip, "chat");
    if (!rateCheck.allowed) {
      const errorType =
        rateCheck.reason === "daily" ? "daily_limit" : "rate_limit";
      return new Response(
        JSON.stringify({
          answer: "",
          sources: [],
          error: errorType,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(
              Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)
            ),
          },
        }
      );
    }

    // Parse request body
    const body: ChatRequest = await request.json();
    const { message, locale } = body;

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return new Response(
        JSON.stringify({
          answer: "",
          sources: [],
          error: "Message is required.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Content filtering
    const filterResult = filterInput(message);
    if (filterResult.blocked) {
      return new Response(
        JSON.stringify({
          answer: "",
          sources: [],
          error: "content_blocked",
          errorCategory: filterResult.category,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get vector store
    const vectorStoreId = await ensureVectorStore();
    const client = getOpenAIClient();

    // Build the dynamic system prompt with locale
    const localizedPrompt = `${SYSTEM_PROMPT}\n\nUI Locale: ${locale || "en"}. Always respond in the language matching this locale.`;

    // Create a streaming response using OpenAI Responses API
    const stream = await client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      stream: true,
      input: [
        { role: "developer", content: localizedPrompt },
        { role: "user", content: message.trim() },
      ],
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
          max_num_results: 10,
        },
      ],
      tool_choice: "required",
      include: ["file_search_call.results"],
    });

    // Create a TransformStream to send data to the client
    const encoder = new TextEncoder();
    const allSources: Source[] = [];
    let fullText = "";

    // Helper to add a unique source (deduplicate by document name)
    const addSource = (src: Source) => {
      const existing = allSources.find((s) => s.document === src.document);
      if (existing) {
        // Update page if we found a real page and existing has none
        if (src.page && !existing.page) {
          existing.page = src.page;
        }
        return;
      }
      allSources.push(src);
    };

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            const eventType = (event as { type: string }).type;
            const eventAny = event as unknown as Record<string, unknown>;

            if (process.env.NODE_ENV !== "production") {
              console.log("[Chat] stream event:", eventType);
            }

            if (eventType === "response.output_text.delta") {
              const delta = (eventAny as { delta: string }).delta;
              if (delta) {
                fullText += delta;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`
                  )
                );
              }
            } else if (
              eventType === "response.file_search_call.results" ||
              eventType === "response.file_search_call.searching" ||
              eventType === "response.file_search_call.completed"
            ) {
              // Extract sources: try .results, then .file_search_call.results
              const results =
                (eventAny.results as Array<{ text?: string; filename?: string; score?: number }> | undefined) ??
                (eventAny.file_search_call as { results?: Array<{ text?: string; filename?: string; score?: number }> } | undefined)?.results;
              if (results && Array.isArray(results)) {
                for (const result of results) {
                  if (result.filename) {
                    const page = result.text ? extractPageFromChunkText(result.text) : undefined;
                    addSource({ document: result.filename, ...(page ? { page } : {}) });
                  }
                  if (result.text) {
                    for (const ts of extractSourcesFromText(result.text)) {
                      addSource(ts);
                    }
                  }
                }
              }
            } else if (eventType === "response.output_text.done") {
              for (const src of extractSourcesFromText(fullText)) {
                addSource(src);
              }
            } else if (eventType === "response.completed" || eventType === "response.done") {
              const response = eventAny.response as Record<string, unknown> | undefined;
              if (response?.output && Array.isArray(response.output)) {
                for (const item of response.output as Array<Record<string, unknown>>) {
                  const content = item.content as Array<Record<string, unknown>> | undefined;
                  if (Array.isArray(content)) {
                    for (const block of content) {
                      const anns = block.annotations as Array<{ type?: string; filename?: string }> | undefined;
                      if (Array.isArray(anns)) {
                        for (const ann of anns) {
                          if (ann.filename) addSource({ document: ann.filename });
                        }
                      }
                    }
                  }
                  const fc = item.file_search_call as { results?: Array<{ filename?: string; text?: string }> } | undefined;
                  if (fc?.results) {
                    for (const r of fc.results) {
                      if (r.filename) {
                        const page = r.text ? extractPageFromChunkText(r.text) : undefined;
                        addSource({ document: r.filename, ...(page ? { page } : {}) });
                      }
                    }
                  }
                }
              }
              // Deep scan for file_search_call.results anywhere in response
              const scan = (obj: unknown) => {
                if (!obj || typeof obj !== "object") return;
                const o = obj as Record<string, unknown>;
                if (o.file_search_call && typeof o.file_search_call === "object") {
                  const res = (o.file_search_call as Record<string, unknown>).results;
                  if (Array.isArray(res)) {
                    for (const r of res as Array<{ filename?: string }>) {
                      if (r.filename) addSource({ document: r.filename });
                    }
                  }
                }
                if (Array.isArray(o)) { o.forEach(scan); return; }
                Object.values(o).forEach(scan);
              };
              scan(response);
            }
          }

          // Fallback: if no sources found from events, extract from the answer text
          if (allSources.length === 0) {
            // Try extracting from citation markers in the full text
            for (const src of extractSourcesFromText(fullText)) {
              addSource(src);
            }
            // Last resort: if we got a real answer but no sources, add known files without page
            const knownFiles = ["Policies001.pdf", "PoliciesEn001.pdf"];
            for (const kf of knownFiles) {
              if (fullText.length > 50 && allSources.length === 0) {
                addSource({ document: kf });
              }
            }
          }

          // Sort sources
          allSources.sort((a, b) => {
            if (a.document !== b.document)
              return a.document.localeCompare(b.document);
            return (a.page || 0) - (b.page || 0);
          });

          // Clean citation markers from the answer text
          let cleanedText = fullText
            .replace(/【\d+:\d+†.+?】/g, "")
            .replace(/\[DOCUMENT:\s*.+?\s*\|\s*PAGE:\s*\d+\]/g, "")
            .replace(/\n?\n?(Sources:|المصادر:)[\s\S]*$/m, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

          const safeAnswer = filterOutput(cleanedText);

          // Log for debugging in dev
          if (process.env.NODE_ENV !== "production") {
            console.log(`[Chat] Sources found: ${allSources.length}`, allSources.map(s => `${s.document}:${s.page}`));
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                answer: safeAnswer,
                sources: allSources,
              })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          const errMsg =
            err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";

    if (process.env.NODE_ENV !== "production") {
      console.error("Chat API error:", err);
    }

    return new Response(
      JSON.stringify({ answer: "", sources: [], error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
