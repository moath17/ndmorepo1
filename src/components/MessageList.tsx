"use client";

import { useEffect, useRef } from "react";
import { Bot, User } from "lucide-react";
import type { ChatMessage, Dictionary, Locale } from "@/types";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  dict: Dictionary;
  locale: Locale;
}

function SourceBadge({
  document,
  page,
  locale,
}: {
  document: string;
  page: number;
  locale: Locale;
}) {
  const pageLabel = locale === "ar" ? "صفحة" : "Page";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-medium rounded-md border border-primary-200">
      {document} - {pageLabel} {page}
    </span>
  );
}

function ThinkingIndicator({ dict }: { dict: Dictionary }) {
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
          <span className="text-sm text-gray-500">{dict.chat.thinking}</span>
        </div>
      </div>
    </div>
  );
}

export default function MessageList({
  messages,
  isLoading,
  dict,
  locale,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            {dict.chat.heading}
          </h2>
          <p className="text-sm text-gray-500">{dict.chat.welcomeMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto chat-scrollbar p-4 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex items-start gap-3 ${
            msg.role === "user" ? "flex-row-reverse" : ""
          }`}
        >
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              msg.role === "user"
                ? "bg-primary-600"
                : "bg-primary-100"
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
            className={`max-w-[80%] ${
              msg.role === "user"
                ? "bg-primary-600 text-white rounded-2xl rounded-tr-sm"
                : "bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm"
            } px-4 py-3`}
          >
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {msg.content}
            </div>

            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">
                  {dict.chat.sources}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {msg.sources.map((source, idx) => (
                    <SourceBadge
                      key={`${source.document}-${source.page}-${idx}`}
                      document={source.document}
                      page={source.page}
                      locale={locale}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {isLoading && <ThinkingIndicator dict={dict} />}

      <div ref={endRef} />
    </div>
  );
}
