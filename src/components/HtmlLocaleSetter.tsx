"use client";

import { useEffect } from "react";
import type { Locale } from "@/types";

export default function HtmlLocaleSetter({ locale }: { locale: Locale }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", locale);
    root.setAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    document.body.classList.remove("font-arabic", "font-sans");
    document.body.classList.add(locale === "ar" ? "font-arabic" : "font-sans");
  }, [locale]);

  return null;
}
