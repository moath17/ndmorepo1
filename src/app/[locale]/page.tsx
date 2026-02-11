import { getDictionary } from "@/i18n/dictionaries";
import ChatInterface from "@/components/ChatInterface";
import NotesButton from "@/components/NotesButton";
import WelcomeGate from "@/components/WelcomeGate";
import type { Locale } from "@/types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale as Locale;
  const dict = await getDictionary(locale);

  return (
    <main className="min-h-screen bg-gray-50">
      <h1 className="sr-only">{dict.meta.title}</h1>
      <p className="sr-only">{dict.meta.description}</p>

      <WelcomeGate dict={dict} locale={locale}>
        <ChatInterface dict={dict} locale={locale} />
        <NotesButton dict={dict} locale={locale} />
      </WelcomeGate>
    </main>
  );
}
