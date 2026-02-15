"use client";

import { useState } from "react";

interface PdfViewerProps {
  file: string;
  page: number;
  locale: string;
}

export default function PdfViewer({ file, page, locale }: PdfViewerProps) {
  const [loading, setLoading] = useState(true);
  const isAr = locale === "ar";

  const fileToLoad = /\.txt$/i.test(file) ? file.replace(/\.txt$/i, ".pdf") : file;
  const pdfUrl = `/pdfs/${encodeURIComponent(fileToLoad)}#page=${page}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {isAr ? `صفحة ${page}` : `Page ${page}`} — {fileToLoad}
      </p>

      {loading && (
        <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 rounded-xl">
          <p className="text-gray-500">{isAr ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      )}

      <iframe
        src={pdfUrl}
        className="w-full rounded-lg border border-gray-200 shadow-lg bg-white"
        style={{ height: "85vh", display: loading ? "none" : "block" }}
        onLoad={() => setLoading(false)}
        title={fileToLoad}
      />
    </div>
  );
}
