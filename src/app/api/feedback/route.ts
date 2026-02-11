import { NextRequest, NextResponse } from "next/server";
import { recordInteraction, rateInteraction } from "@/lib/learning";
import { trackSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "record") {
      // Record a new interaction (called when chat response is complete)
      const { sessionId, userName, locale, question, answer, sources, responseTimeMs } =
        body;
      if (!question || !answer) {
        return NextResponse.json(
          { error: "question and answer are required" },
          { status: 400 }
        );
      }
      // Track user session with name
      if (sessionId) {
        trackSession(sessionId, userName || undefined, locale);
      }
      const id = recordInteraction({
        sessionId: sessionId || "unknown",
        userName: userName || undefined,
        timestamp: new Date().toISOString(),
        locale: locale || "en",
        question,
        answer,
        sources: sources || [],
        rating: null,
        feedbackReason: null,
        responseTimeMs: responseTimeMs || 0,
      });
      return NextResponse.json({ success: true, interactionId: id });
    }

    if (action === "rate") {
      // Rate an existing interaction
      const { interactionId, rating, feedbackReason } = body;
      if (!interactionId || !rating) {
        return NextResponse.json(
          { error: "interactionId and rating are required" },
          { status: 400 }
        );
      }
      const success = rateInteraction(interactionId, rating, feedbackReason);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
