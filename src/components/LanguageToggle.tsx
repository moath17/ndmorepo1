"use client";

import { useRouter, usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import type { Locale, Dictionary } from "@/types";

interface LanguageToggleProps {
  locale: Locale;
  dict: Dictionary;
}

export default function LanguageToggle({ locale, dict }: LanguageToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = () => {
    const newLocale: Locale = locale === "en" ? "ar" : "en";
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <button
      onClick={switchLocale}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium
                 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50
                 border border-gray-200 rounded-lg transition-colors
                 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
      aria-label={dict.language.toggle}
    >
      <Globe className="w-4 h-4" />
      <span>{locale === "en" ? dict.language.ar : dict.language.en}</span>
    </button>
  );
}
