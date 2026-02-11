import { getDictionary } from "@/i18n/dictionaries";
import { isValidLocale } from "@/i18n/config";
import type { Locale } from "@/types";
import AdminPanel from "@/components/AdminPanel";

interface AdminPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : "en";
  const dict = await getDictionary(locale);

  return <AdminPanel dict={dict} locale={locale} />;
}
