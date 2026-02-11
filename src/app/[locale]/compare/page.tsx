import { redirect } from "next/navigation";
import { isValidLocale } from "@/i18n/config";
import type { Locale } from "@/types";

interface ComparePageProps {
  params: Promise<{ locale: string }>;
}

// Redirect old compare URL to gap analysis
export default async function ComparePage({ params }: ComparePageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : "en";
  redirect(`/${locale}/gap-analysis`);
}
