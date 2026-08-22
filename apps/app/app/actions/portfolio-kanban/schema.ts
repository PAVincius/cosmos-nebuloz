import { z } from "zod";

const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const KanbanColumnSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(64),
  color: z.string().regex(COLOR_REGEX, "Cor inválida (#RRGGBB)"),
  wipLimit: z.number().int().min(1).optional(),
});
export type KanbanColumnConfig = z.infer<typeof KanbanColumnSchema>;

export const KanbanConfigSchema = z.object({
  columns: z.array(KanbanColumnSchema).min(1).max(20),
});
export type KanbanConfig = z.infer<typeof KanbanConfigSchema>;

export const UpdateColumnColorSchema = z.object({
  columnId: z.string().min(1),
  color: z.string().regex(COLOR_REGEX),
});

export const UpdateColumnLabelSchema = z.object({
  columnId: z.string().min(1),
  label: z.string().min(1).max(64),
});

export const UpdateWipLimitSchema = z.object({
  columnId: z.string().min(1),
  wipLimit: z.number().int().min(1).nullable(),
});

const LIFECYCLE_COLUMNS = [
  "FUNNEL",
  "ANALYZING",
  "PORTFOLIO_BACKLOG",
  "IMPLEMENTING",
  "DONE",
  "REJECTED",
] as const;
type LifecycleColumn = (typeof LIFECYCLE_COLUMNS)[number];

export const MoveEpicSchema = z.object({
  epicId: z.string().min(1),
  toColumn: z.enum(LIFECYCLE_COLUMNS),
  reason: z.string().min(20).optional(),
  wipOverrideReason: z.string().min(5).optional(),
});
type MoveEpicInput = z.infer<typeof MoveEpicSchema>;

export const DEFAULT_PORTFOLIO_COLUMNS: KanbanColumnConfig[] = [
  { id: "FUNNEL", label: "Funnel", color: "#71717a", wipLimit: 10 },
  { id: "ANALYZING", label: "Analyzing", color: "#8b5cf6", wipLimit: 5 },
  {
    id: "PORTFOLIO_BACKLOG",
    label: "Portfolio Backlog",
    color: "#5e6ad2",
    wipLimit: 5,
  },
  { id: "IMPLEMENTING", label: "Implementing", color: "#0ea5e9", wipLimit: 3 },
  { id: "DONE", label: "Done", color: "#27a644" },
  { id: "REJECTED", label: "Rejected", color: "#dc2626" },
];
