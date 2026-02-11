"use client";

import { useState, useRef, useCallback } from "react";
import { Send } from "lucide-react";
import type { Dictionary } from "@/types";

interface ChatInputProps {
  dict: Dictionary;
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ dict, onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        120
      )}px`;
    }
  }, []);

  return (
    <div className="border-t border-gray-200 bg-white p-2.5 sm:p-4">
      <div className="flex items-end gap-2 sm:gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={dict.chat.placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50
                       px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-gray-900 placeholder-gray-400
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
            aria-label={dict.chat.placeholder}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          className="flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center
                     bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300
                     text-white rounded-xl transition-colors
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1
                     disabled:cursor-not-allowed"
          aria-label={dict.chat.send}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
