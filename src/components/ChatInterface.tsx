"use client";

import { useState, useCallback, useEffect } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import FileUpload from "./FileUpload";
import UploadedFilesList from "./UploadedFilesList";
import LanguageToggle from "./LanguageToggle";
import { FileText, PanelLeftClose, PanelLeft } from "lucide-react";
import type { ChatMessage, Dictionary, Locale, UploadedFile, Source, ChatResponse } from "@/types";

interface ChatInterfaceProps {
  dict: Dictionary;
  locale: Locale;
}

export default function ChatInterface({ dict, locale }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch already-uploaded files on mount
  useEffect(() => {
    fetch("/api/files")
      .then((res) => res.json())
      .then((data) => {
        if (data.files) {
          setUploadedFiles(data.files);
        }
      })
      .catch(() => {
        // Silently ignore
      });
  }, []);

  const handleFilesUploaded = useCallback((newFiles: UploadedFile[]) => {
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;

      // Check if files are uploaded
      if (uploadedFiles.length === 0) {
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: dict.chat.errorNoFiles,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }

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

        if (data.error === "no_files") {
          const errorMsg: ChatMessage = {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: dict.chat.errorNoFiles,
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
        let sources: Source[] = data.sources || [];

        // Also try to extract sources line from the answer text and clean it
        let answerText = data.answer || "";

        // Remove the "Sources: ..." line from the answer if present (it's duplicated in sources array)
        const sourcesLineRegex =
          /\n?\n?(Sources:|المصادر:)[\s\S]*$/;
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
    [isLoading, uploadedFiles.length, dict, locale]
  );

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? "w-80" : "w-0"}
          flex-shrink-0 bg-white border-e border-gray-200
          transition-all duration-300 overflow-hidden
        `}
      >
        <div className="w-80 h-full p-4 overflow-y-auto chat-scrollbar">
          <FileUpload dict={dict} onFilesUploaded={handleFilesUploaded} />
          <UploadedFilesList dict={dict} files={uploadedFiles} />
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-5 h-5" />
              ) : (
                <PanelLeft className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <h1 className="text-base font-semibold text-gray-800">
                {dict.chat.heading}
              </h1>
            </div>
          </div>
          <LanguageToggle locale={locale} dict={dict} />
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          isLoading={isLoading}
          dict={dict}
          locale={locale}
        />

        {/* Input */}
        <ChatInput
          dict={dict}
          onSend={handleSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
