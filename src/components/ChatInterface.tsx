"use client";

import { useState, useCallback } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import LanguageToggle from "./LanguageToggle";
import { FileText } from "lucide-react";
import type {
  ChatMessage,
  Dictionary,
  Locale,
  Source,
  ChatResponse,
} from "@/types";

interface ChatInterfaceProps {
  dict: Dictionary;
  locale: Locale;
}

export default function ChatInterface({ dict, locale }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, locale }),
        });

        const data: ChatResponse = await response.json();

        if (response.status === 429) {
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: dict.chat.errorRateLimit,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        if (data.error && !data.answer) {
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: dict.chat.errorGeneric,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          return;
        }

        // Parse sources from the response
        const sources: Source[] = data.sources || [];

        // Clean answer text: remove duplicate "Sources:" line if sources are in the array
        let answerText = data.answer || "";
        const sourcesLineRegex = /\n?\n?(Sources:|المصادر:)[\s\S]*$/;
        const sourcesMatch = answerText.match(sourcesLineRegex);
        if (sourcesMatch && sources.length > 0) {
          answerText = answerText.replace(sourcesLineRegex, "").trim();
        }

        const assistantMessage: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: answerText,
          sources: sources.length > 0 ? sources : undefined,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: dict.chat.errorGeneric,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, dict, locale]
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800">
              {dict.chat.heading}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {dict.chat.subheading}
            </p>
          </div>
        </div>
        <LanguageToggle locale={locale} dict={dict} />
      </header>

      {/* Messages */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        dict={dict}
        locale={locale}
      />

      {/* Input */}
      <ChatInput dict={dict} onSend={handleSendMessage} disabled={isLoading} />
    </div>
  );
}
