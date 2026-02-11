"use client";

import { Lightbulb } from "lucide-react";
import type { Dictionary } from "@/types";

interface SuggestedQuestionsProps {
  dict: Dictionary;
  onSend: (question: string) => void;
  disabled?: boolean;
}

export default function SuggestedQuestions({
  dict,
  onSend,
  disabled,
}: SuggestedQuestionsProps) {
  const suggestions = dict.chat.suggestions || [];

  if (suggestions.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-4">
      <div className="flex items-center gap-2 mb-2 sm:mb-3 text-gray-500">
        <Lightbulb className="w-4 h-4" />
        <span className="text-xs sm:text-sm font-medium">
          {dict.chat.suggestionsTitle}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSend(suggestion)}
            disabled={disabled}
            className="text-start px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-gray-200 bg-white
              hover:border-primary-300 hover:bg-primary-50 hover:shadow-sm
              transition-all duration-200 text-xs sm:text-sm text-gray-700
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
