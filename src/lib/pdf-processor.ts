import pdf from "pdf-parse";

interface PageText {
  pageNumber: number;
  text: string;
}

/**
 * Extract text from a PDF buffer, page by page.
 * Returns an array of { pageNumber, text } objects.
 */
export async function extractPagesFromPDF(
  buffer: Buffer
): Promise<PageText[]> {
  const pages: PageText[] = [];

  // pdf-parse options to capture per-page text
  const options = {
    // Custom page renderer to get text per page
    pagerender: async function (pageData: {
      getTextContent: () => Promise<{
        items: Array<{ str: string; transform: number[] }>;
      }>;
    }) {
      const textContent = await pageData.getTextContent();
      const strings = textContent.items.map(
        (item: { str: string }) => item.str
      );
      return strings.join(" ");
    },
  };

  const data = await pdf(buffer, options);

  // pdf-parse with custom pagerender returns text per page in data.text
  // separated by page breaks, but we need individual pages.
  // Let's use a different approach: parse with page tracking

  // Actually, pdf-parse calls pagerender for each page.
  // We need to capture each page's text individually.
  // Let's reparse with a tracking callback.

  const pageTexts: string[] = [];

  const trackingOptions = {
    pagerender: async function (pageData: {
      getTextContent: () => Promise<{
        items: Array<{ str: string; transform: number[] }>;
      }>;
    }) {
      const textContent = await pageData.getTextContent();
      const strings = textContent.items.map(
        (item: { str: string }) => item.str
      );
      const pageText = strings.join(" ").trim();
      pageTexts.push(pageText);
      return pageText;
    },
  };

  await pdf(buffer, trackingOptions);

  for (let i = 0; i < pageTexts.length; i++) {
    if (pageTexts[i].length > 0) {
      pages.push({
        pageNumber: i + 1,
        text: pageTexts[i],
      });
    }
  }

  return pages;
}

/**
 * Convert extracted pages into a single text string with PAGE markers.
 * Format: [DOCUMENT: filename | PAGE: N]\n<text>\n\n
 */
export function formatPagesForVectorStore(
  documentName: string,
  pages: PageText[]
): string {
  const sections = pages.map(
    (page) =>
      `[DOCUMENT: ${documentName} | PAGE: ${page.pageNumber}]\n${page.text}`
  );

  return sections.join("\n\n---\n\n");
}

/**
 * Get total page count from a PDF buffer
 */
export async function getPDFPageCount(buffer: Buffer): Promise<number> {
  const data = await pdf(buffer);
  return data.numpages;
}
