"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Copy, Check } from "lucide-react";
import ChatChart from "./ChatChart";

interface MarkdownRendererProps {
  content: string;
}

/**
 * Try to detect if the AI returned a fenced code block with chart data
 */
function extractChartBlocks(
  text: string
): { before: string; chart: unknown; after: string }[] | null {
  const chartRegex = /```chart\s*\n([\s\S]*?)```/g;
  let match;
  const results: { before: string; chart: unknown; after: string }[] = [];
  let lastIndex = 0;

  while ((match = chartRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      results.push({
        before: text.slice(lastIndex, match.index),
        chart: parsed,
        after: "",
      });
      lastIndex = match.index + match[0].length;
    } catch {
      // Not valid JSON, skip
    }
  }

  if (results.length > 0) {
    results[results.length - 1].after = text.slice(lastIndex);
    return results;
  }
  return null;
}

/**
 * Try to detect a simple table in the AI response with numeric data.
 */
function detectTableData(
  text: string
): { labels: string[]; values: number[]; title?: string } | null {
  const tableRegex =
    /\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/g;
  const match = tableRegex.exec(text);
  if (!match) return null;

  const headers = match[1]
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean);
  const rows = match[2]
    .trim()
    .split("\n")
    .map((row) =>
      row
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
    );

  if (headers.length < 2 || rows.length < 2) return null;

  let numColIdx = -1;
  for (let col = 1; col < headers.length; col++) {
    const allNumeric = rows.every((row) => {
      const val = row[col]?.replace(/[,%]/g, "");
      return val && !isNaN(Number(val));
    });
    if (allNumeric) {
      numColIdx = col;
      break;
    }
  }

  if (numColIdx === -1) return null;

  const labels = rows.map((row) => row[0] || "");
  const values = rows.map((row) => {
    const val = row[numColIdx]?.replace(/[,%]/g, "") || "0";
    return Number(val);
  });

  return { labels, values, title: headers[numColIdx] };
}

/** Copy table as tab-separated values (Excel-compatible) */
function CopyTableButton({ tableEl }: { tableEl: HTMLTableElement | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!tableEl) return;
    try {
      const rows = tableEl.querySelectorAll("tr");
      const text = Array.from(rows)
        .map((row) =>
          Array.from(row.querySelectorAll("th, td"))
            .map((cell) => cell.textContent?.trim() || "")
            .join("\t")
        )
        .join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-1 end-1 inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 bg-white/80 hover:bg-white rounded-md border border-gray-200 transition-all opacity-0 group-hover:opacity-100"
      title="Copy table"
    >
      {copied ? (
        <Check className="w-3 h-3 text-emerald-500" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  );
}

function TableWrapper({
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  const [tableRef, setTableRef] = useState<HTMLTableElement | null>(null);

  return (
    <div className="overflow-x-auto my-3 relative group" {...props}>
      <table
        ref={setTableRef}
        className="min-w-full border-collapse text-sm"
      >
        {children}
      </table>
      <CopyTableButton tableEl={tableRef} />
    </div>
  );
}

const markdownComponents: Components = {
  table: ({ children }) => <TableWrapper>{children}</TableWrapper>,
  thead: ({ children, ...props }) => (
    <thead className="bg-primary-50" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="px-3 py-2 text-start font-semibold text-primary-700 border border-primary-200"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td
      className="px-3 py-2 border border-gray-200 text-gray-700"
      {...props}
    >
      {children}
    </td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="even:bg-gray-50" {...props}>
      {children}
    </tr>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside space-y-1 my-2" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-inside space-y-1 my-2" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-gray-900" {...props}>
      {children}
    </strong>
  ),
  h1: ({ children, ...props }) => (
    <h1 className="text-lg font-bold text-gray-900 mt-3 mb-1" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-base font-bold text-gray-900 mt-3 mb-1" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-bold text-gray-900 mt-2 mb-1" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="my-1" {...props}>
      {children}
    </p>
  ),
  code: ({ children, className, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-gray-100 text-primary-700 px-1 py-0.5 rounded text-xs font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="block bg-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2"
        {...props}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-s-4 border-primary-300 bg-primary-50/50 ps-3 pe-3 py-2 my-2 text-gray-700 rounded-e-lg"
      {...props}
    >
      {children}
    </blockquote>
  ),
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Check for explicit chart blocks
  const chartBlocks = extractChartBlocks(content);
  if (chartBlocks) {
    return (
      <div className="text-sm leading-relaxed">
        {chartBlocks.map((block, i) => (
          <div key={i}>
            {block.before && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {block.before}
              </ReactMarkdown>
            )}
            <ChatChart data={block.chart} />
            {block.after && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {block.after}
              </ReactMarkdown>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Check if there's a table with numeric data
  const tableData = detectTableData(content);

  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
      {tableData && (
        <ChatChart
          data={{
            type: "bar",
            data: tableData.labels.map((label, i) => ({
              name: label,
              value: tableData.values[i],
            })),
            title: tableData.title,
          }}
        />
      )}
    </div>
  );
}
