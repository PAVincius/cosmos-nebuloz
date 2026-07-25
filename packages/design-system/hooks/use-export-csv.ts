"use client";

import { useCallback } from "react";

type CsvColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
};

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.accessor(row))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function useExportCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string
) {
  return useCallback(() => {
    const csv = buildCsv(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, columns, filename]);
}
