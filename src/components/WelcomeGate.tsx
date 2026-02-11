"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FileText, ArrowLeft, ArrowRight, Globe } from "lucide-react";
import type { Dictionary, Locale } from "@/types";

interface WelcomeGateProps {
  dict: Dictionary;
  locale: Locale;
  children: React.ReactNode;
}

/**
 * Shows a simple name input before allowing access to the chat.
 * Saves name and session ID in localStorage.
 */
export default function WelcomeGate({
  dict,
  locale,
  children,
}: WelcomeGateProps) {
  const isAr = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [name, setName] = useState("");

  const toggleLang = () => {
    const newLocale = isAr ? "en" : "ar";
    const newPath = pathname.replace(/^\/(ar|en)/, `/${newLocale}`);
    router.push(newPath);
  };

  // Check if user is already registered
  useEffect(() => {
    const savedName = localStorage.getItem("ndmo-user-name");
    const savedId = localStorage.getItem("ndmo-session-id");
    if (savedName && savedId) {
      setRegistered(true);
    } else {
      setRegistered(false);
    }
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Save name and generate session ID
    localStorage.setItem("ndmo-user-name", trimmed);
    let sessionId = localStorage.getItem("ndmo-session-id");
    if (!sessionId) {
      sessionId = `user-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("ndmo-session-id", sessionId);
    }

    setRegistered(true);
  };

  // Loading state
  if (registered === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already registered — show children
  if (registered) {
    return <>{children}</>;
  }

  // Registration screen
  const Arrow = isAr ? ArrowLeft : ArrowRight;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 max-w-md w-full text-center relative mx-2 sm:mx-0">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          {isAr ? "EN" : "عربي"}
        </button>

        {/* Logo */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-primary-200">
          <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
          {dict.chat.heading}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mb-6 sm:mb-8 leading-relaxed">
          {isAr
            ? "مرحباً بك! أدخل اسمك للبدء في استخدام المساعد الذكي."
            : "Welcome! Enter your name to start using the smart assistant."}
        </p>

        {/* Name input */}
        <div className="mb-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder={isAr ? "اسمك (مثال: محمد)" : "Your name (e.g. Ahmed)"}
            maxLength={50}
            className="w-full px-5 py-3.5 rounded-2xl border-2 border-gray-200 text-center text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-300 transition-all placeholder:text-gray-300"
            autoFocus
          />
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full py-3.5 rounded-2xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-200 hover:shadow-primary-300"
        >
          {isAr ? "ابدأ المحادثة" : "Start Chat"}
          <Arrow className="w-4 h-4" />
        </button>

        {/* Required notice */}
        <p className="mt-4 text-xs text-gray-400">
          {isAr ? "* إدخال الاسم مطلوب للمتابعة" : "* Name is required to continue"}
        </p>
      </div>
    </div>
  );
}
