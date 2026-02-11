import { getDictionary } from "@/i18n/dictionaries";
import { isValidLocale } from "@/i18n/config";
import type { Locale } from "@/types";
import GapAnalysis from "@/components/GapAnalysis";
import Navigation from "@/components/Navigation";
import LanguageToggle from "@/components/LanguageToggle";
import { Search } from "lucide-react";

interface GapAnalysisPageProps {
  params: Promise<{ locale: string }>;
}

export default async function GapAnalysisPage({
  params,
}: GapAnalysisPageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : "en";
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800">
              {dict.gapAnalysis.title}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {dict.gapAnalysis.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Navigation dict={dict} locale={locale} />
          <LanguageToggle locale={locale} dict={dict} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <GapAnalysis dict={dict} locale={locale} />
      </main>
    </div>
  );
}
