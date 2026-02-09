import type { Dictionary, Locale } from "@/types";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./en.json").then((m) => m.default as Dictionary),
  ar: () => import("./ar.json").then((m) => m.default as Dictionary),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = dictionaries[locale];
  if (!loader) {
    return dictionaries.en();
  }
  return loader();
}
