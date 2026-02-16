import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { ensureVectorStore } from "@/lib/vector-store";
import { checkRateLimit } from "@/lib/rate-limiter";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { filterInput, filterOutput } from "@/lib/content-filter";
import { getClientIP } from "@/lib/utils";
import { recordUsage } from "@/lib/api-usage-store";
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
    const pageNums = Array.from(match[1].matchAll(/\d+/g), (m) => parseInt(m[0], 10));
    for (const page of pageNums) add(doc, page);
  }

  // Pattern 3b: "Page 1, Page 2 from PoliciesEn001.pdf"
  const enBlock = /(Page\s*\d+(?:\s*,\s*Page\s*\d+)*)\s*from\s*(Policies001\.pdf|PoliciesEn001\.pdf)/gi;
  while ((match = enBlock.exec(text)) !== null) {
    const doc = match[2];
    const pageNums = Array.from(match[1].matchAll(/\d+/g), (m) => parseInt(m[0], 10));
    for (const page of pageNums) add(doc, page);
  }

  return sources;
}

/** Extract page number from the [DOCUMENT: ... | PAGE: N] marker in chunk text. */
function extractPageFromChunkText(text: string): number | undefined {
  if (!text || typeof text !== "string") return undefined;
  // Primary: the exact marker added by setup-knowledge-base script
  const marker = text.match(/\[DOCUMENT:\s*.+?\s*\|\s*PAGE:\s*(\d+)\]/);
  if (marker) {
    const p = parseInt(marker[1], 10);
    if (p > 0 && p < 10000) return p;
  }
  // Fallback: explicit "page: N" or "page = N"
  const fallback = text.match(/page\s*[:=]\s*(\d+)/i);
  if (fallback) {
    const p = parseInt(fallback[1], 10);
    if (p > 0 && p < 10000) return p;
  }
  return undefined;
}

/** Extract page number from per-page filename like Policies001_page_045.txt */
function extractPageFromFilename(filename: string): number | undefined {
  if (!filename) return undefined;
  const m = filename.match(/_page_(\d+)\./);
  if (m) {
    const p = parseInt(m[1], 10);
    if (p > 0 && p < 10000) return p;
  }
  return undefined;
}

/** Resolve per-page filename to original PDF name: Policies001_page_045.txt → Policies001.pdf */
function resolveOriginalDocument(filename: string): string {
  const pageMatch = filename.match(/^(.+?)_page_\d+\.(txt|pdf)$/i);
  if (pageMatch) {
    return pageMatch[1] + ".pdf";
  }
  return filename.replace(/\.txt$/i, ".pdf");
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
      temperature: 0.3,
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
                    const score = result.score ?? 0;
                    if (score < 0.4) continue;
                    const page = extractPageFromFilename(result.filename) ?? (result.text ? extractPageFromChunkText(result.text) : undefined);
                    const doc = resolveOriginalDocument(result.filename);
                    addSource({ document: doc, ...(page ? { page } : {}) });
                  }
                }
              }
            } else if (eventType === "response.output_text.done") {
              for (const src of extractSourcesFromText(fullText)) {
                addSource(src);
              }
            } else if (eventType === "response.completed" || eventType === "response.done") {
              const response = eventAny.response as Record<string, unknown> | undefined;
              // Track API token usage
              const usage = response?.usage as { input_tokens?: number; output_tokens?: number } | undefined;
              if (usage) {
                recordUsage(usage.input_tokens || 0, usage.output_tokens || 0).catch(() => {});
              }
              if (response?.output && Array.isArray(response.output)) {
                for (const item of response.output as Array<Record<string, unknown>>) {
                  const content = item.content as Array<Record<string, unknown>> | undefined;
                  if (Array.isArray(content)) {
                    for (const block of content) {
                      const anns = block.annotations as Array<{ type?: string; filename?: string }> | undefined;
                      if (Array.isArray(anns)) {
                        for (const ann of anns) {
                          if (ann.filename) {
                            const page = extractPageFromFilename(ann.filename);
                            const doc = resolveOriginalDocument(ann.filename);
                            addSource({ document: doc, ...(page ? { page } : {}) });
                          }
                        }
                      }
                    }
                  }
                  const fc = item.file_search_call as { results?: Array<{ filename?: string; text?: string; score?: number }> } | undefined;
                  if (fc?.results) {
                    for (const r of fc.results) {
                      if (r.filename) {
                        const fcScore = (r as { score?: number }).score ?? 0;
                        if (fcScore < 0.4) continue;
                        const page = extractPageFromFilename(r.filename) ?? (r.text ? extractPageFromChunkText(r.text) : undefined);
                        const doc = resolveOriginalDocument(r.filename);
                        addSource({ document: doc, ...(page ? { page } : {}) });
                      }
                    }
                  }
                }
              }
              // Deep scan removed: rely on explicit citations and annotations only
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
            // Also check for per-page filenames
            const pageFilePattern = /(Policies001|PoliciesEn001)_page_(\d+)/g;
            let pfMatch;
            while ((pfMatch = pageFilePattern.exec(fullText)) !== null) {
              const doc = pfMatch[1] + ".pdf";
              const page = parseInt(pfMatch[2], 10);
              if (page > 0) addSource({ document: doc, page });
            }
          }

          // Sort sources and limit to top 5 most relevant
          allSources.sort((a, b) => {
            if (a.document !== b.document)
              return a.document.localeCompare(b.document);
            return (a.page || 0) - (b.page || 0);
          });
          const limitedSources = allSources.slice(0, 5);

          // Clean citation markers and page-number blocks from the answer text
          let cleanedText = fullText
            .replace(/【\d+:\d+†.+?】/g, "")
            .replace(/【\d+†.+?】/g, "")
            .replace(/\[DOCUMENT:\s*.+?\s*\|\s*PAGE:\s*\d+\]/g, "")
            // Remove long Arabic page lists: "صفحة N، صفحة N، ..." (with or without "من filename")
            .replace(/(صفحة\s*\d+\s*[،,]\s*)+صفحة\s*\d+(\s*من\s*\S+)?/g, "")
            // Remove standalone "صفحة N من filename"
            .replace(/صفحة\s*\d+\s*من\s*(Policies001|PoliciesEn001)\.(pdf|txt)/gi, "")
            // Remove long English page lists: "Page N, Page N, ..." (with or without "from filename")
            .replace(/(Page\s*\d+\s*,\s*)+Page\s*\d+(\s*from\s*\S+)?/gi, "")
            // Remove whole lines that are only page lists (Arabic or English)
            .replace(/^[ \t]*(صفحة\s*\d+(?:\s*[،,]\s*صفحة\s*\d+)*)[ \t]*$/gm, "")
            .replace(/^[ \t]*(Page\s*\d+(?:\s*,\s*Page\s*\d+)*)[ \t]*$/gim, "")
            // Remove standalone single "صفحة N" on its own line
            .replace(/^[ \t]*صفحة\s*\d+[ \t]*$/gm, "")
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
          const noSources = limitedSources.length === 0 && isNotFoundAnswer;

          // Log for debugging in dev
          if (process.env.NODE_ENV !== "production") {
            console.log(`[Chat] Sources found: ${limitedSources.length} (of ${allSources.length} total)`, limitedSources.map(s => `${s.document}:${s.page}`));
            console.log(`[Chat] noSources=${noSources}, answerLength=${safeAnswer.length}`);
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                answer: safeAnswer,
                sources: limitedSources,
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
