"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Download } from "lucide-react";

export type ReportData = {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
};

export function parseReports(content: string): ReportData[] {
  const regex = /<report\s+title="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/report>/g;
  const results: ReportData[] = [];
  for (const match of content.matchAll(regex)) {
    try {
      const parsed = JSON.parse(match[2]);
      if (Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
        results.push({
          title: match[1],
          columns: parsed.columns,
          rows: parsed.rows,
        });
      }
    } catch {
      // skip malformed
    }
  }
  return results;
}

export function stripReportTags(content: string): string {
  return content.replace(/<report[\s\S]*?<\/report>/g, "").trim();
}

function exportCsv(report: ReportData): void {
  const allRows = [report.columns, ...report.rows];
  const csv = allRows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.title.replace(/\s+/g, "_")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type CopilotReportProps = { report: ReportData };

export function CopilotReport({ report }: CopilotReportProps) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between border-black/[0.06] border-b bg-gray-50 px-3 py-2 dark:border-white/[0.06] dark:bg-zinc-800/60">
        <span className="font-semibold text-gray-800 text-xs dark:text-zinc-200">
          {report.title}
        </span>
        <Button
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={() => exportCsv(report)}
          size="sm"
          variant="ghost"
        >
          <Download className="h-3 w-3" />
          CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-black/[0.06] border-b dark:border-white/[0.06]">
              {report.columns.map((col) => (
                <th
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-600 dark:text-zinc-400"
                  key={col}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => {
              const rowKey = row.map(String).join("|");
              return (
                <tr
                  className="border-black/[0.04] border-b last:border-0 hover:bg-gray-50 dark:border-white/[0.04] dark:hover:bg-zinc-800/40"
                  key={rowKey}
                >
                  {row.map((cell, j) => (
                    <td
                      className="px-3 py-2 text-gray-700 dark:text-zinc-300"
                      key={report.columns[j] ?? j}
                    >
                      {String(cell ?? "—")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
