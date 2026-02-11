import { getDictionary } from "@/i18n/dictionaries";
import { isValidLocale } from "@/i18n/config";
import type { Locale, PoliciesStructure } from "@/types";
import policiesData from "@/data/policies-structure.json";
import PolicySummary from "@/components/PolicySummary";
import PolicyTree from "@/components/PolicyTree";
import PolicyCharts from "@/components/PolicyCharts";
import DashboardDocuments from "@/components/DashboardDocuments";
import Navigation from "@/components/Navigation";
import LanguageToggle from "@/components/LanguageToggle";
import { BarChart3 } from "lucide-react";

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : "en";
  const dict = await getDictionary(locale);
  const structure = policiesData as PoliciesStructure;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-sm">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-800">
              {dict.dashboard.title}
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">
              {dict.dashboard.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Navigation dict={dict} locale={locale} />
          <LanguageToggle locale={locale} dict={dict} />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* 1. Summary Stats */}
        <section>
          <PolicySummary structure={structure} dict={dict} />
        </section>

        {/* 2. Charts */}
        <section>
          <PolicyCharts
            domains={structure.domains}
            dict={dict}
            locale={locale}
          />
        </section>

        {/* 3. Policy Structure (Hierarchical) */}
        <section>
          <PolicyTree
            domains={structure.domains}
            dict={dict}
            locale={locale}
          />
        </section>

        {/* 4. Documents */}
        <section>
          <DashboardDocuments
            documents={structure.summary.documents}
            dict={dict}
            locale={locale}
          />
        </section>
      </main>
    </div>
  );
}
