import type { Locale } from "@/types";

export const locales: Locale[] = ["en", "ar"];
export const defaultLocale: Locale = "en";

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
