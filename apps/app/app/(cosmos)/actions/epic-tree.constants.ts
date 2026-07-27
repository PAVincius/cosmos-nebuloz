// Constantes e tipos da árvore Epic → Feature → Story → Task.
// Vive fora de epic-tree.ts porque arquivos "use server" só podem exportar
// funções async — mapas, schemas Zod e tipos ficam aqui e são importados
// tanto pelas actions quanto pelos client components.
import type { MemberRole } from "@repo/auth/server";
import { z } from "zod";
import type { Tone } from "@/components/cosmos/kit";

// ─── Blocos da nota nativa ────────────────────────────────────────────────

export type ChecklistItem = { id: string; text: string; done: boolean };

export type TaskBlock =
  | { id: string; kind: "heading"; text: string }
  | { id: string; kind: "paragraph"; text: string }
  | { id: string; kind: "code"; text: string }
  | { id: string; kind: "checklist"; items: ChecklistItem[] };

const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  done: z.boolean(),
});

export const TaskBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1),
    kind: z.literal("heading"),
    text: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("paragraph"),
    text: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("code"),
    text: z.string(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal("checklist"),
    items: z.array(ChecklistItemSchema),
  }),
]);

export const TaskBlocksSchema = z.array(TaskBlockSchema).max(200);

// Retorna null (nunca um array parcial) quando o payload persistido não bate
// com o schema — noteBlocks é uma coluna Json e pode conter lixo legado.
export function parseTaskBlocks(raw: unknown): TaskBlock[] | null {
  const parsed = TaskBlocksSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const DEFAULT_NOTE_BLOCKS: TaskBlock[] = [
  { id: "seed-heading", kind: "heading", text: "Resultado" },
  {
    id: "seed-paragraph",
    kind: "paragraph",
    text: "Descreva o resultado esperado desta task.",
  },
  {
    id: "seed-checklist",
    kind: "checklist",
    items: [
      { id: "seed-item-1", text: "Primeira sub-task", done: false },
      { id: "seed-item-2", text: "Segunda sub-task", done: false },
    ],
  },
];

// ─── Nós da árvore ────────────────────────────────────────────────────────

export type StoryNode = {
  id: string;
  title: string;
  acceptanceCriteria: string | null;
  status: string;
  storyPoints: number;
};

export type TaskNode = {
  id: string;
  title: string;
  status: string;
  estimateHours: number | null;
  assigneeName: string | null;
  // null ⇒ task nativa Cosmos
  externalSource: string | null;
  externalId: string | null;
  externalUrl: string | null;
  blocks: TaskBlock[] | null;
};

export type StoryTasks = {
  tasks: TaskNode[];
  // sources com Integration.status === "ACTIVE" neste tenant
  connectedSources: string[];
};

// ─── Providers externos ───────────────────────────────────────────────────

export type ProviderMeta = {
  label: string;
  letter: string;
  tone: Tone;
  buildUrl: (ref: string) => string;
};

export const PROVIDERS: Record<string, ProviderMeta> = {
  jira: {
    label: "Jira Software",
    letter: "J",
    tone: "accent",
    buildUrl: (ref) => `https://cosmos.atlassian.net/browse/${ref}`,
  },
  linear: {
    label: "Linear",
    letter: "L",
    tone: "purple",
    buildUrl: (ref) => `https://linear.app/cosmos/issue/${ref}`,
  },
  github: {
    label: "GitHub",
    letter: "G",
    tone: "accent",
    buildUrl: (ref) =>
      `https://github.com/cosmos/cosmos/issues/${ref.replace("#", "")}`,
  },
  notion: {
    label: "Notion",
    letter: "N",
    tone: "neutral",
    buildUrl: (ref) => `https://notion.so/${ref}`,
  },
  trello: {
    label: "Trello",
    letter: "T",
    tone: "blue",
    buildUrl: (ref) => `https://trello.com/c/${ref}`,
  },
  asana: {
    label: "Asana",
    letter: "A",
    tone: "amber",
    buildUrl: (ref) => `https://app.asana.com/0/0/${ref}`,
  },
  gitlab: {
    label: "GitLab",
    letter: "GL",
    tone: "amber",
    buildUrl: (ref) =>
      `https://gitlab.com/cosmos/cosmos/-/issues/${ref.replace("#", "")}`,
  },
};

// ─── Status ───────────────────────────────────────────────────────────────

// Task.status é String no schema (comentário do model lista TODO/IN_PROGRESS/
// DONE). REVIEW é o quarto estado pedido pelo handoff — nenhuma migração
// necessária, mas mantido nesta lista fechada para não virar campo livre.
export const TASK_STATUSES: readonly {
  id: string;
  label: string;
  tone: Tone;
}[] = [
  { id: "TODO", label: "A Fazer", tone: "neutral" },
  { id: "IN_PROGRESS", label: "Em andamento", tone: "blue" },
  { id: "REVIEW", label: "Em revisão", tone: "amber" },
  { id: "DONE", label: "Concluído", tone: "green" },
] as const;

export const TASK_STATUS_IDS = TASK_STATUSES.map((s) => s.id);

// Story.status real: BACKLOG/TODO/IN_PROGRESS/REVIEW/DONE/SPLIT_INTO.
export const STORY_STATUS_TONE: Record<string, Tone> = {
  BACKLOG: "neutral",
  TODO: "neutral",
  IN_PROGRESS: "blue",
  REVIEW: "amber",
  DONE: "green",
  SPLIT_INTO: "purple",
};

export const WRITE_ROLES: MemberRole[] = ["ADMIN", "RTE", "SM", "PO", "DEV"];
