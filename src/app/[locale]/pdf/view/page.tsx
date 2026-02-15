import type { Locale } from "@/types";
import PdfViewer from "./PdfViewer";
import Link from "next/link";

export default async function PdfViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ file?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { file, page } = await searchParams;
  const isAr = locale === "ar";
  const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : 1;

  if (!file?.trim()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{isAr ? "لم يُحدد ملف." : "No file specified."}</p>
          <Link href={`/${locale}`} className="text-primary-600 hover:underline">
            {isAr ? "العودة للرئيسية" : "Back to home"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 mb-6"
        >
          ← {isAr ? "العودة للمرشد" : "Back to guide"}
        </Link>
        <PdfViewer file={file} page={pageNum} locale={locale} />
      </div>
    </div>
  );
}
