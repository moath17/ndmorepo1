"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { Dictionary, Locale } from "@/types";

interface DocumentInfo {
  name: string;
  file: string;
  pages: number;
  language: string;
}

interface DashboardDocumentsProps {
  documents: DocumentInfo[];
  dict: Dictionary;
  locale: Locale;
}

export default function DashboardDocuments({
  documents,
  dict,
  locale,
}: DashboardDocumentsProps) {
  const [search, setSearch] = useState("");
  const isAr = locale === "ar";

  const filtered = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.file.toLowerCase().includes(search.toLowerCase())
  );

  const docLabel = isAr ? "المستند" : "Document";
  const pagesLabel = isAr ? "الصفحات" : "Pages";
  const langLabel = isAr ? "اللغة" : "Language";
  const searchPlaceholder = isAr ? "ابحث في المستندات..." : "Search documents...";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-gray-800">
          {dict.dashboard.documents}
        </h2>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="ps-9 pe-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-48 sm:w-64"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-start py-2 px-3 text-gray-500 font-medium">
                #
              </th>
              <th className="text-start py-2 px-3 text-gray-500 font-medium">
                {docLabel}
              </th>
              <th className="text-start py-2 px-3 text-gray-500 font-medium">
                {pagesLabel}
              </th>
              <th className="text-start py-2 px-3 text-gray-500 font-medium">
                {langLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((doc, idx) => (
              <tr
                key={doc.file}
                className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
              >
                <td className="py-2 px-3 text-gray-400">{idx + 1}</td>
                <td className="py-2 px-3 text-gray-700 font-medium">
                  {doc.name}
                </td>
                <td className="py-2 px-3 text-gray-600">{doc.pages}</td>
                <td className="py-2 px-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      doc.language === "ar"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {doc.language === "ar"
                      ? dict.language.ar
                      : dict.language.en}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-gray-400 text-sm"
                >
                  {isAr ? "لا توجد نتائج" : "No results found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
