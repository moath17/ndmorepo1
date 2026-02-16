"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker from local public folder
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PdfViewerProps {
  file: string;
  page: number;
  locale: string;
}

export default function PdfViewer({ file, page, locale }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const isAr = locale === "ar";

  const fileToLoad = /\.txt$/i.test(file) ? file.replace(/\.txt$/i, ".pdf") : file;
  const pdfUrl = `/pdfs/${encodeURIComponent(fileToLoad)}`;

  useEffect(() => {
    setCurrentPage(page);
  }, [page]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      if (!canvasRef.current) return;

      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        setNumPages(pdf.numPages);

        // Ensure page is within bounds
        const pageToRender = Math.min(Math.max(1, currentPage), pdf.numPages);

        const pdfPage = await pdf.getPage(pageToRender);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        // Scale for better quality on high DPI screens
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        if (cancelled) return;
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load PDF");
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      window.history.replaceState(null, "", `?file=${encodeURIComponent(fileToLoad)}&page=${currentPage - 1}`);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
      window.history.replaceState(null, "", `?file=${encodeURIComponent(fileToLoad)}&page=${currentPage + 1}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {isAr ? `صفحة ${currentPage} من ${numPages || "..."}` : `Page ${currentPage} of ${numPages || "..."}`}
        </p>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary-600 hover:underline"
        >
          {isAr ? "فتح الملف الأصلي" : "Open original file"}
        </a>
      </div>

      {error && (
        <div className="min-h-[80vh] flex items-center justify-center bg-red-50 rounded-xl border border-red-200">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {loading && !error && (
        <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 rounded-xl">
          <p className="text-gray-500">{isAr ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-gray-200 shadow-lg bg-white"
        style={{ display: loading || error ? "none" : "block" }}
      />

      {/* Navigation buttons */}
      {!loading && !error && numPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
          >
            {isAr ? "السابقة" : "Previous"}
          </button>
          <span className="text-sm text-gray-600">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage === numPages}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
          >
            {isAr ? "التالية" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
