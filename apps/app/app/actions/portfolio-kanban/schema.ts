import { z } from "zod";

export const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const KanbanColumnSchema = z.object({
  id:    z.string().min(1).max(64),
  label: z.string().min(1).max(64),
  color: z.string().regex(COLOR_REGEX, "Cor inválida (#RRGGBB)"),
});
export type KanbanColumnConfig = z.infer<typeof KanbanColumnSchema>;

export const KanbanConfigSchema = z.object({
  columns: z.array(KanbanColumnSchema).min(1).max(20),
});
export type KanbanConfig = z.infer<typeof KanbanConfigSchema>;

export const UpdateColumnColorSchema = z.object({
  columnId: z.string().min(1),
  color:    z.string().regex(COLOR_REGEX),
});

export const UpdateColumnLabelSchema = z.object({
  columnId: z.string().min(1),
  label:    z.string().min(1).max(64),
});

export const DEFAULT_PORTFOLIO_COLUMNS: KanbanColumnConfig[] = [
  { id: "BACKLOG",           label: "Funnel",            color: "#71717a" },
  { id: "REVIEW",            label: "Reviewing",         color: "#d97706" },
  { id: "ANALYSIS",          label: "Analyzing",         color: "#8b5cf6" },
  { id: "PORTFOLIO_BACKLOG", label: "Portfolio Backlog", color: "#5e6ad2" },
  { id: "IMPLEMENTING",      label: "Implementing",      color: "#0ea5e9" },
  { id: "DONE",              label: "Done",              color: "#27a644" },
];
