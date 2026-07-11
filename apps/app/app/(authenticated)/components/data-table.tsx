import type { ReactNode } from "react";

export type DataTableColumn<Row> = {
  key: string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
  render?: (row: Row) => ReactNode;
};

export type DataTableProps<Row> = {
  columns: Array<DataTableColumn<Row>>;
  rows: Row[];
  onRowClick?: (row: Row) => void;
  getRowKey?: (row: Row, index: number) => string | number;
};

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  onRowClick,
  getRowKey,
}: DataTableProps<Row>) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="whitespace-nowrap border-b py-[9px] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
              style={{
                textAlign: col.align === "right" ? "right" : "left",
                color: "var(--ink-faint)",
                borderColor: "var(--hairline)",
                background: "var(--surface-2)",
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={getRowKey ? getRowKey(row, i) : i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className="transition-colors duration-150 [&>td]:border-b [&>td]:[border-color:var(--hairline)] last:[&>td]:border-b-0 hover:[&>td]:bg-[var(--surface-2)]"
            style={{ cursor: onRowClick ? "pointer" : undefined }}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                className="py-[10px] px-3 align-middle"
                style={{
                  textAlign: col.align === "right" ? "right" : "left",
                  fontFamily: col.mono ? "var(--font-mono)" : undefined,
                  color: col.mono ? "var(--ink-muted)" : "var(--ink)",
                }}
              >
                {col.render ? col.render(row) : String(row[col.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
