"use client";

import { useState } from "react";
import { MessageCircle, X, Send, Check } from "lucide-react";
import type { Dictionary, Locale } from "@/types";

interface NotesButtonProps {
  dict: Dictionary;
  locale: Locale;
}

export default function NotesButton({ dict, locale }: NotesButtonProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const isAr = locale === "ar";

  const handleSubmit = async () => {
    if (!content.trim() || sending) return;
    setSending(true);

    try {
      const sessionId = localStorage.getItem("ndmo-session-id") || "unknown";
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, sessionId, locale }),
      });
      setSuccess(true);
      setContent("");
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 2000);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 end-4 z-40 w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-all flex items-center justify-center hover:scale-105"
        title={dict.notes.buttonLabel}
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
      </button>

      {/* Notes panel */}
      {open && (
        <div
          className="fixed bottom-36 end-4 z-40 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2"
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="px-4 py-3 bg-primary-600 text-white">
            <h3 className="text-sm font-semibold">{dict.notes.title}</h3>
          </div>

          {success ? (
            <div className="p-6 text-center">
              <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600">{dict.notes.success}</p>
            </div>
          ) : (
            <div className="p-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={dict.notes.placeholder}
                rows={4}
                maxLength={1000}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  {content.length}/1000
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || sending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {dict.notes.submit}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
