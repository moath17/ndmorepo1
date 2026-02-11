import { getDictionary } from "@/i18n/dictionaries";
import { isValidLocale } from "@/i18n/config";
import type { Locale } from "@/types";
import AssessmentForm from "@/components/AssessmentForm";
import Navigation from "@/components/Navigation";
import LanguageToggle from "@/components/LanguageToggle";
import { ClipboardCheck } from "lucide-react";

interface AssessmentPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AssessmentPage({ params }: AssessmentPageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : "en";
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-semibold text-gray-800 truncate">
              {dict.assessment.title}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {dict.assessment.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <Navigation dict={dict} locale={locale} />
          <LanguageToggle locale={locale} dict={dict} />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <AssessmentForm dict={dict} locale={locale} />
      </main>
    </div>
  );
}
