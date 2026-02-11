"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/types";

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  locale: Locale;
}

const REASONS = [
  {
    id: "incorrect",
    ar: "الإجابة غير صحيحة",
    en: "Incorrect answer",
  },
  {
    id: "incomplete",
    ar: "الإجابة ناقصة",
    en: "Incomplete answer",
  },
  {
    id: "wrong_source",
    ar: "المصدر خطأ",
    en: "Wrong source cited",
  },
  {
    id: "didnt_understand",
    ar: "ما فهم سؤالي",
    en: "Didn't understand my question",
  },
];

export default function FeedbackDialog({
  isOpen,
  onClose,
  onSubmit,
  locale,
}: FeedbackDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const isAr = locale === "ar";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95"
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">
            {isAr ? "وش المشكلة؟" : "What went wrong?"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {REASONS.map((reason) => (
            <button
              key={reason.id}
              onClick={() => setSelected(reason.id)}
              className={`w-full text-start px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                selected === reason.id
                  ? "bg-primary-50 border-primary-300 text-primary-700"
                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {isAr ? reason.ar : reason.en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (selected) {
                onSubmit(selected);
                setSelected(null);
              }
            }}
            disabled={!selected}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAr ? "إرسال" : "Submit"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
