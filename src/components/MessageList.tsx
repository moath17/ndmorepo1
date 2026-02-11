"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, User, ThumbsUp, ThumbsDown, Copy, Check, Reply, ExternalLink } from "lucide-react";
import SuggestedQuestions from "./SuggestedQuestions";
import MarkdownRenderer from "./MarkdownRenderer";
import type { ChatMessage, Dictionary, Locale, Source } from "@/types";

type StreamPhase = "idle" | "searching" | "generating" | "done";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamPhase?: StreamPhase;
  dict: Dictionary;
  locale: Locale;
  onSendSuggestion?: (question: string) => void;
  onRate?: (messageId: string, rating: "up" | "down") => void;
  ratings?: Record<string, "up" | "down">;
  onReply?: (content: string) => void;
}

// Map file names to real document titles
const DOCUMENT_NAME_MAP: Record<string, string> = {
  "Policies001.pdf": "ضوابط ومواصفات إدارة البيانات الوطنية",
  "PoliciesAr.pdf": "سياسات حوكمة البيانات الوطنية",
  "PoliciesEn001.pdf":
    "Data Management & Personal Data Protection Standards",
  "PoliciesEn-b.pdf": "National Data Governance Interim Regulations",
  "Data-Governance-Policy.pdf": "Data Governance Policy",
  "Data Classification Policy.pdf": "Data Classification Policy",
  "Data Sharing Policy.pdf": "Data Sharing Policy",
  "Open Data Policy.pdf": "Open Data Policy",
  "DCC-.pdf": "ضوابط الأمن السيبراني للبيانات",
  "download.pdf": "الترتيبات التنظيمية لهيئة البيانات والذكاء الاصطناعي",
};

function getDisplayName(filename: string): string {
  if (DOCUMENT_NAME_MAP[filename]) return DOCUMENT_NAME_MAP[filename];
  for (const [key, value] of Object.entries(DOCUMENT_NAME_MAP)) {
    if (
      filename.includes(key.replace(".pdf", "")) ||
      key.includes(filename.replace(".pdf", ""))
    ) {
      return value;
    }
  }
  return filename.replace(/\.(pdf|txt)$/i, "");
}

function SourceBadge({
  source,
  locale,
}: {
  source: Source;
  locale: Locale;
}) {
  const pageLabel = locale === "ar" ? "صفحة" : "Page";
  const displayName = getDisplayName(source.document);
  const hasPage = source.page && source.page > 0;
  const pdfUrl = hasPage
    ? `/pdfs/${encodeURIComponent(source.document)}#page=${source.page}`
    : `/pdfs/${encodeURIComponent(source.document)}`;

  return (
    <a
      href={pdfUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-sm cursor-pointer transition-all active:scale-95"
      title={hasPage ? `${displayName} - ${pageLabel} ${source.page}` : displayName}
    >
      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate max-w-[200px]">{displayName}</span>
      {hasPage && (
        <span className="bg-emerald-200/60 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
          {pageLabel} {source.page}
        </span>
      )}
    </a>
  );
}

function CopyButton({ text, locale }: { text: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  const isAr = locale === "ar";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
      title={isAr ? "نسخ" : "Copy"}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-500" />
          <span className="text-emerald-500">{isAr ? "تم" : "Copied"}</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>{isAr ? "نسخ" : "Copy"}</span>
        </>
      )}
    </button>
  );
}

function ThinkingIndicator({
  dict,
  phase,
}: {
  dict: Dictionary;
  phase: StreamPhase;
}) {
  let statusText = dict.chat.thinking;
  if (phase === "searching") {
    statusText = dict.chat.searching;
  } else if (phase === "generating") {
    statusText = dict.chat.generating;
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
        <Bot className="w-4 h-4 text-primary-600" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce animation-delay-200" />
            <span className="w-2 h-2 bg-primary-400 rounded-full animate-bounce animation-delay-400" />
          </div>
          <span className="text-sm text-gray-500">{statusText}</span>
        </div>
      </div>
    </div>
  );
}

export default function MessageList({
  messages,
  isLoading,
  streamPhase = "idle",
  dict,
  locale,
  onSendSuggestion,
  onRate,
  ratings = {},
  onReply,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            {dict.chat.heading}
          </h2>
          <p className="text-sm text-gray-500">{dict.chat.welcomeMessage}</p>
        </div>
        {onSendSuggestion && (
          <SuggestedQuestions dict={dict} onSend={onSendSuggestion} />
        )}
      </div>
    );
  }

  const lastMessage = messages[messages.length - 1];
  const isStreaming =
    isLoading &&
    lastMessage?.role === "assistant" &&
    lastMessage.content.length > 0;
  const showThinking =
    isLoading &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      (lastMessage.role === "assistant" && lastMessage.content.length === 0));

  return (
    <div className="flex-1 overflow-y-auto chat-scrollbar p-3 sm:p-4 space-y-3 sm:space-y-4">
      {messages.map((msg) => {
        if (msg.role === "assistant" && msg.content.length === 0 && isLoading)
          return null;

        const currentRating = ratings[msg.id];
        const isCurrentStreaming = isStreaming && msg.id === lastMessage?.id;
        const showActions =
          msg.role === "assistant" &&
          msg.content.length > 0 &&
          !isCurrentStreaming;

        return (
          <div key={msg.id}>
            <div
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === "user" ? "bg-primary-600" : "bg-primary-100"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-primary-600" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-primary-600 text-white rounded-2xl rounded-tr-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm"
                } px-3 sm:px-4 py-2.5 sm:py-3`}
              >
                {msg.role === "assistant" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                )}

                {/* Streaming cursor */}
                {isCurrentStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-primary-400 animate-pulse ml-0.5 align-text-bottom" />
                )}

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-2">
                      {dict.chat.sources}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((source, idx) => (
                        <SourceBadge
                          key={`${source.document}-${source.page}-${idx}`}
                          source={source}
                          locale={locale}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action bar: Reply + Copy + Thumbs up/down */}
            {showActions && (
              <div
                className={`flex items-center gap-1 mt-1 ${
                  msg.role === "user" ? "justify-end" : "ms-11"
                }`}
              >
                {msg.role === "assistant" && onReply && (
                  <button
                    onClick={() => onReply(msg.content)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title={dict.chat.reply}
                  >
                    <Reply className="w-3 h-3" />
                    <span>{dict.chat.reply}</span>
                  </button>
                )}
                <CopyButton text={msg.content} locale={locale} />
                {onRate && (
                  <>
                    <button
                      onClick={() => onRate(msg.id, "up")}
                      className={`p-1 rounded-md transition-colors ${
                        currentRating === "up"
                          ? "text-emerald-500 bg-emerald-50"
                          : "text-gray-400 hover:text-emerald-500 hover:bg-emerald-50"
                      }`}
                      title={dict.chat.helpful}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRate(msg.id, "down")}
                      className={`p-1 rounded-md transition-colors ${
                        currentRating === "down"
                          ? "text-red-500 bg-red-50"
                          : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                      }`}
                      title={dict.chat.notHelpful}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showThinking && <ThinkingIndicator dict={dict} phase={streamPhase} />}

      <div ref={endRef} />
    </div>
  );
}
