"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, ClipboardCheck } from "lucide-react";
import type { Dictionary, Locale } from "@/types";

interface NavigationProps {
  dict: Dictionary;
  locale: Locale;
}

const navItems = [
  { key: "chat" as const, href: "", icon: MessageSquare },
  { key: "assessment" as const, href: "/assessment", icon: ClipboardCheck },
];

export default function Navigation({ dict, locale }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 sm:gap-1 bg-gray-100 rounded-lg p-0.5 sm:p-1">
      {navItems.map((item) => {
        const fullHref = `/${locale}${item.href}`;
        const isActive =
          item.href === ""
            ? pathname === `/${locale}` || pathname === `/${locale}/`
            : pathname.startsWith(fullHref);
        const Icon = item.icon;
        const label = dict.nav[item.key];

        return (
          <Link
            key={item.key}
            href={fullHref}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${
                isActive
                  ? "bg-white text-primary-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
