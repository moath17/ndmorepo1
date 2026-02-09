import { getDictionary } from "@/i18n/dictionaries";
import ChatInterface from "@/components/ChatInterface";
import type { Locale } from "@/types";

export default async function ChatPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale as Locale;
  const dict = await getDictionary(locale);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* SEO: Semantic heading visually hidden but available to crawlers */}
      <h1 className="sr-only">{dict.meta.title}</h1>
      <p className="sr-only">{dict.meta.description}</p>

      <ChatInterface dict={dict} locale={locale} />
    </main>
  );
}
