"use client";

import { useState, useCallback, useRef } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import LanguageToggle from "./LanguageToggle";
import Navigation from "./Navigation";
import FeedbackDialog from "./FeedbackDialog";
import { FileText } from "lucide-react";
import type { ChatMessage, Dictionary, Locale, Source } from "@/types";

interface ChatInterfaceProps {
  dict: Dictionary;
  locale: Locale;
}

type StreamPhase = "idle" | "searching" | "generating" | "done";

// Generate or retrieve guest session ID
function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("ndmo-session-id");
  if (!id) {
    id = `guest-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem("ndmo-session-id", id);
  }
  return id;
}

export default function ChatInterface({ dict, locale }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const [feedbackDialog, setFeedbackDialog] = useState<{
    open: boolean;
    messageId: string | null;
    interactionId: string | null;
  }>({ open: false, messageId: null, interactionId: null });
  const [ratings, setRatings] = useState<
    Record<string, "up" | "down">
  >({});
  const [replyContext, setReplyContext] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Map message IDs to interaction IDs for feedback
  const interactionMap = useRef<Record<string, string>>({});

  const recordInteraction = useCallback(
    async (
      question: string,
      answer: string,
      sources: Source[],
      messageId: string,
      responseTimeMs: number
    ) => {
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record",
            sessionId: getSessionId(),
            userName: typeof window !== "undefined" ? localStorage.getItem("ndmo-user-name") || undefined : undefined,
            locale,
            question,
            answer,
            sources,
            responseTimeMs,
          }),
        });
        const data = await res.json();
        if (data.interactionId) {
          interactionMap.current[messageId] = data.interactionId;
        }
      } catch {
        // Non-critical, ignore
      }
    },
    [locale]
  );

  const handleRate = useCallback(
    async (messageId: string, rating: "up" | "down") => {
      const interactionId = interactionMap.current[messageId];
      if (!interactionId) return;

      if (rating === "down") {
        setFeedbackDialog({
          open: true,
          messageId,
          interactionId,
        });
        return;
      }

      // Thumbs up — send immediately
      setRatings((prev) => ({ ...prev, [messageId]: rating }));
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rate",
            interactionId,
            rating: "up",
          }),
        });
      } catch {
        // Non-critical
      }
    },
    []
  );

  const handleFeedbackSubmit = useCallback(
    async (reason: string) => {
      const { messageId, interactionId } = feedbackDialog;
      if (!messageId || !interactionId) return;

      setRatings((prev) => ({ ...prev, [messageId]: "down" }));
      setFeedbackDialog({ open: false, messageId: null, interactionId: null });

      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rate",
            interactionId,
            rating: "down",
            feedbackReason: reason,
          }),
        });
      } catch {
        // Non-critical
      }
    },
    [feedbackDialog]
  );

  const handleReply = useCallback((assistantContent: string) => {
    // Truncate to first 200 chars as context
    const snippet = assistantContent.length > 200
      ? assistantContent.slice(0, 200) + "..."
      : assistantContent;
    setReplyContext(snippet);
  }, []);

  const clearReply = useCallback(() => {
    setReplyContext(null);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;

      // If replying, prepend context
      let fullMessage = content;
      if (replyContext) {
        const prefix = locale === "ar" ? dict.chat.replyPrefix : dict.chat.replyPrefix;
        fullMessage = `${prefix} "${replyContext}"\n\n${content}`;
        setReplyContext(null);
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setStreamPhase("searching");

      const abortController = new AbortController();
      abortRef.current = abortController;

      const assistantId = `asst-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const startTime = Date.now();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: fullMessage, locale }),
          signal: abortController.signal,
        });

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          if (response.status === 429) {
            const isDailyLimit = data.error === "daily_limit";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: isDailyLimit
                        ? dict.chat.errorDailyLimit
                        : dict.chat.errorRateLimit,
                    }
                  : m
              )
            );
            return;
          }
          if (data.error && !data.answer) {
            let displayError = dict.chat.errorGeneric;
            if (data.error === "content_blocked") {
              displayError = dict.chat.errorBlocked;
            } else if (
              data.error.includes("OPENAI_API_KEY") ||
              data.error.includes("environment variable")
            ) {
              displayError = data.error;
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: displayError } : m
              )
            );
            return;
          }
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";
        let hasStartedText = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));

              if (json.type === "delta") {
                if (!hasStartedText) {
                  hasStartedText = true;
                  setStreamPhase("generating");
                }
                streamedText += json.text;
                // Clean citation markers for display
                const displayText = streamedText
                  .replace(/【\d+:\d+†.+?】/g, "")
                  .replace(/\[DOCUMENT:\s*.+?\s*\|\s*PAGE:\s*\d+\]/g, "");
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: displayText }
                      : m
                  )
                );
              } else if (json.type === "done") {
                const safeAnswer = json.answer || streamedText;
                const sources: Source[] = json.sources || [];

                let answerText = safeAnswer;
                const sourcesLineRegex =
                  /\n?\n?(Sources:|المصادر:)[\s\S]*$/;
                const sourcesMatch = answerText.match(sourcesLineRegex);
                if (sourcesMatch && sources.length > 0) {
                  answerText = answerText.replace(sourcesLineRegex, "").trim();
                }

                const isNotFound =
                  answerText.includes("لم يتم العثور") ||
                  answerText.includes("Not found in the provided");

                const finalSources =
                  !isNotFound && sources.length > 0 ? sources : undefined;

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: answerText, sources: finalSources }
                      : m
                  )
                );
                setStreamPhase("done");

                // Record the interaction for learning
                const elapsed = Date.now() - startTime;
                recordInteraction(
                  content,
                  answerText,
                  finalSources || [],
                  assistantId,
                  elapsed
                );
              } else if (json.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: dict.chat.errorGeneric }
                      : m
                  )
                );
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: dict.chat.errorGeneric }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        setStreamPhase("idle");
        abortRef.current = null;
      }
    },
    [isLoading, dict, locale, recordInteraction, replyContext]
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-gray-800 truncate">
              {dict.chat.heading}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {dict.chat.subheading}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <Navigation dict={dict} locale={locale} />
          <LanguageToggle locale={locale} dict={dict} />
        </div>
      </header>

      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        streamPhase={streamPhase}
        dict={dict}
        locale={locale}
        onSendSuggestion={handleSendMessage}
        onRate={handleRate}
        ratings={ratings}
        onReply={handleReply}
      />

      {/* Reply context bar */}
      {replyContext && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-200 text-xs text-blue-700">
          <span className="font-medium">{dict.chat.replyTo}</span>
          <span className="truncate flex-1 text-blue-600">{replyContext.slice(0, 80)}...</span>
          <button onClick={clearReply} className="text-blue-400 hover:text-blue-600 font-bold px-1">✕</button>
        </div>
      )}

      {/* Input */}
      <ChatInput dict={dict} onSend={handleSendMessage} disabled={isLoading} />

      {/* Feedback Dialog */}
      <FeedbackDialog
        isOpen={feedbackDialog.open}
        onClose={() =>
          setFeedbackDialog({
            open: false,
            messageId: null,
            interactionId: null,
          })
        }
        onSubmit={handleFeedbackSubmit}
        locale={locale}
      />
    </div>
  );
}
