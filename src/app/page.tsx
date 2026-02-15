import { redirect } from "next/navigation";
import { defaultLocale } from "@/i18n/config";

/**
 * Root path: redirect to default locale so opening the site never shows 404.
 */
export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
