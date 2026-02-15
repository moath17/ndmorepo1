import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { ensureVectorStore } from "@/lib/vector-store";
import { checkRateLimit } from "@/lib/rate-limiter";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { filterInput, filterOutput } from "@/lib/content-filter";
import { getClientIP } from "@/lib/utils";
import type { ChatRequest, Source } from "@/types";

/**
 * Extract sources from text containing [DOCUMENT: name | PAGE: N] markers,
 * 【...】 annotation markers that OpenAI adds, or various other citation formats.
 */
function extractSourcesFromText(text: string): Source[] {
  const sources: Source[] = [];
  const add = (doc: string, page?: number) => {
    const p = page && page > 0 ? page : undefined;
    if (!sources.some((s) => s.document === doc && (s.page ?? 0) === (p ?? 0))) {
      sources.push({ document: doc, ...(p != null ? { page: p } : {}) });
    }
  };

  let match;

  // Pattern 1: [DOCUMENT: name | PAGE: N]
  const regex1 = /\[DOCUMENT:\s*(.+?)\s*\|\s*PAGE:\s*(\d+)\]/g;
  while ((match = regex1.exec(text)) !== null) {
    add(match[1].trim(), parseInt(match[2], 10));
  }

  // Pattern 2: 【number:number†filename】
  const regex2 = /【(\d+):(\d+)†(.+?)】/g;
  while ((match = regex2.exec(text)) !== null) {
    add(match[3].trim(), parseInt(match[2], 10));
  }

  // Pattern 2b: 【number†filename】 (without second number)
  const regex2b = /【(\d+)†(.+?)】/g;
  while ((match = regex2b.exec(text)) !== null) {
    add(match[2].trim());
  }

  // Pattern 2c: 【filename】(no numbers, just filename in lenticular brackets)
  const regex2c = /【((?:Policies001|PoliciesEn001)\.(?:pdf|txt))】/g;
  while ((match = regex2c.exec(text)) !== null) {
    add(match[1].trim());
  }

  // Pattern 3: "صفحة 23، صفحة 24، ... من Policies001.pdf"
  const arBlock = /(صفحة\s*\d+(?:\s*[،,]\s*صفحة\s*\d+)*)\s*من\s*(Policies001\.pdf|PoliciesEn001\.pdf)/g;
  while ((match = arBlock.exec(text)) !== null) {
    const doc = match[2];
    const pageNums = [...match[1].matchAll(/\d+/g)].map((m) => parseInt(m[0], 10));
    for (const page of pageNums) add(doc, page);
  }

  // Pattern 3b: "Page 1, Page 2 from PoliciesEn001.pdf"
  const enBlock = /(Page\s*\d+(?:\s*,\s*Page\s*\d+)*)\s*from\s*(Policies001\.pdf|PoliciesEn001\.pdf)/gi;
  while ((match = enBlock.exec(text)) !== null) {
    const doc = match[2];
    const pageNums = [...match[1].matchAll(/\d+/g)].map((m) => parseInt(m[0], 10));
    for (const page of pageNums) add(doc, page);
  }

  // Pattern 4: standalone "صفحة N" or "page N" near a known filename
  const standaloneAr = /صفحة\s+(\d+)/g;
  while ((match = standaloneAr.exec(text)) !== null) {
    const page = parseInt(match[1], 10);
    // Determine which file based on context (look ±200 chars around the match)
    const ctx = text.slice(Math.max(0, match.index - 200), match.index + 200);
    if (ctx.includes("PoliciesEn001")) add("PoliciesEn001.pdf", page);
    else add("Policies001.pdf", page);
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
          max_num_results: 20,
        },
      ],
      tool_choice: "required",
      include: ["file_search_call.results"],
    });

    // Create a TransformStream to send data to the client
    const encoder = new TextEncoder();
    const allSources: Source[] = [];
    let fullText = "";

    // Helper: add source, deduplicate by (document + page) so we can show all related pages (e.g. 15+)
    const addSource = (src: Source) => {
      const already = allSources.some(
        (s) => s.document === src.document && (s.page ?? 0) === (src.page ?? 0)
      );
      if (already) return;
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
            for (const src of extractSourcesFromText(fullText)) {
              addSource(src);
            }
          }

          // Extra fallback: scan for any known filename mentions in the answer
          if (allSources.length === 0) {
            const knownFiles = ["Policies001.pdf", "PoliciesEn001.pdf"];
            for (const kf of knownFiles) {
              if (fullText.includes(kf.replace(".pdf", "")) || fullText.includes(kf)) {
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

          // ALWAYS send the real answer — never empty it just because sources weren't extracted.
          // The model already answered from file_search; failing to parse source markers
          // should not destroy the answer the user saw during streaming.
          const safeAnswer = filterOutput(cleanedText);

          // noSources is true ONLY when the answer itself is empty / "not found"
          const isNotFoundAnswer =
            !safeAnswer ||
            safeAnswer.includes("لم يتم العثور") ||
            safeAnswer.includes("Not found in the provided");
          const noSources = allSources.length === 0 && isNotFoundAnswer;

          // Log for debugging in dev
          if (process.env.NODE_ENV !== "production") {
            console.log(`[Chat] Sources found: ${allSources.length}`, allSources.map(s => `${s.document}:${s.page}`));
            console.log(`[Chat] noSources=${noSources}, answerLength=${safeAnswer.length}`);
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                answer: safeAnswer,
                sources: allSources,
                noSources,
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
