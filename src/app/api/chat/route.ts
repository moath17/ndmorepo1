import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { ensureVectorStore } from "@/lib/vector-store";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getUploadedFileCount } from "@/lib/uploaded-files";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import type { ChatRequest, Source } from "@/types";

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Extract sources from text containing [DOCUMENT: name | PAGE: N] markers.
 */
function extractSourcesFromText(text: string): Source[] {
  const sources: Source[] = [];
  const regex = /\[DOCUMENT:\s*(.+?)\s*\|\s*PAGE:\s*(\d+)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const document = match[1].trim();
    const page = parseInt(match[2], 10);

    // Avoid duplicates
    const exists = sources.some(
      (s) => s.document === document && s.page === page
    );
    if (!exists) {
      sources.push({ document, page });
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
      return NextResponse.json(
        {
          answer: "",
          sources: [],
          error: "rate_limit",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)
            ),
          },
        }
      );
    }

    // Parse request body
    const body: ChatRequest = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { answer: "", sources: [], error: "Message is required." },
        { status: 400 }
      );
    }

    // Check if any files have been uploaded
    const fileCount = await getUploadedFileCount();
    if (fileCount === 0) {
      return NextResponse.json(
        { answer: "", sources: [], error: "no_files" },
        { status: 400 }
      );
    }

    // Get vector store
    const vectorStoreId = await ensureVectorStore();
    const client = getOpenAIClient();

    // Call OpenAI Responses API with file_search
    const response = await client.responses.create({
      model: "gpt-4.1",
      temperature: 0,
      input: [
        { role: "developer", content: SYSTEM_PROMPT },
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

    // Extract the answer text and sources
    let answerText = "";
    const allSources: Source[] = [];

    for (const output of response.output) {
      if (output.type === "message" && output.content) {
        for (const content of output.content) {
          if (content.type === "output_text") {
            answerText = content.text;
          }
        }
      }

      // Parse search results for page numbers from [DOCUMENT: ... | PAGE: N] markers
      if (output.type === "file_search_call") {
        // Access search results - the shape depends on the include parameter
        const outputAny = output as unknown as Record<string, unknown>;
        const results = outputAny.results as
          | Array<{ text?: string; filename?: string }>
          | undefined;

        if (results) {
          for (const result of results) {
            if (result.text) {
              const chunkSources = extractSourcesFromText(result.text);
              for (const cs of chunkSources) {
                const exists = allSources.some(
                  (s) => s.document === cs.document && s.page === cs.page
                );
                if (!exists) {
                  allSources.push(cs);
                }
              }
            }
          }
        }
      }
    }

    // Also try to extract sources from the answer text itself
    // (the model might include [DOCUMENT: ... | PAGE: N] references)
    const answerSources = extractSourcesFromText(answerText);
    for (const as2 of answerSources) {
      const exists = allSources.some(
        (s) => s.document === as2.document && s.page === as2.page
      );
      if (!exists) {
        allSources.push(as2);
      }
    }

    // Sort sources by document name then page number
    allSources.sort((a, b) => {
      if (a.document !== b.document)
        return a.document.localeCompare(b.document);
      return a.page - b.page;
    });

    return NextResponse.json({
      answer: answerText,
      sources: allSources,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";

    if (process.env.NODE_ENV !== "production") {
      console.error("Chat API error:", err);
    }

    return NextResponse.json(
      { answer: "", sources: [], error: message },
      { status: 500 }
    );
  }
}
