/**
 * Shared foundation for all server actions.
 * Import from here — never duplicate these primitives.
 */
import { log } from "@repo/observability/log";
import { z } from "zod";

// ─── Result type ──────────────────────────────────────────────────────────────

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; error: string; code?: string };
export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}
export function err(error: string, code?: string): Err {
  // Sem `code`, a chave não existe: `code: undefined` vira "$undefined" na
  // serialização das server actions e chega ao cliente como lixo.
  return code === undefined ? { ok: false, error } : { ok: false, error, code };
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type PaginationInput = z.infer<typeof PaginationSchema>;

export type PageMeta = {
  total: number;
  page: number;
  limit: number;
  pageCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextCursor?: string;
};
export type Page<T> = { items: T[]; meta: PageMeta };

export function paginationArgs(page = 1, limit = 20) {
  return { skip: (page - 1) * limit, take: limit };
}

export function buildPage<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): Page<T> {
  return {
    items,
    meta: {
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

// ─── Error handling ───────────────────────────────────────────────────────────

export function toActionError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Erro inesperado";
}

/** Só um identificador `dominio.motivo` (letras, dígitos, ponto, hífen e
 *  sublinhado, começando por letra, até 80) é aceito como code. Texto livre, e-mail
 *  ou id numa `rule` não sai do servidor: o code é para o cliente distinguir a
 *  recusa, nunca para carregar dado. */
const RULE_CODE = /^[A-Za-z][\w.-]{0,79}$/;

/** Regra de domínio nomeada do erro (`MeridianRuleError.rule`, etc.), quando há.
 *  Vai no `code` do Result para o cliente distinguir a recusa pela regra, não
 *  pelo texto da mensagem. */
function ruleOf(error: unknown): string | undefined {
  const rule = (error as { rule?: unknown } | null)?.rule;
  return typeof rule === "string" && RULE_CODE.test(rule) ? rule : undefined;
}

// Safe wrapper — returns Result instead of throwing
export async function safeAction<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (!(e instanceof z.ZodError)) {
      log.error("[safeAction]", { error: String(e) });
    }
    return err(toActionError(e), ruleOf(e));
  }
}

// ─── Shared Zod primitives ────────────────────────────────────────────────────

export const cuid = z.string().cuid();
export const nnStr = z.string().min(1).max(255).trim(); // non-empty string
export const optStr = z.string().max(10_000).trim().optional(); // optional long text
export const optCuid = z.string().cuid().optional();
export const isoDate = z.coerce.date();
export const optDate = z.coerce.date().optional();

export const SortOrder = z.enum(["asc", "desc"]).default("desc");

// ─── Common enums ─────────────────────────────────────────────────────────────

export const SprintStatus = z.enum(["PLANNING", "ACTIVE", "COMPLETED"]);
export const StoryStatus = z.enum([
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
]);
export const TaskStatus = z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]);
export const Severity = z.enum(["critical", "high", "medium", "low"]);
export const ImpedimentStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);
export const DefectStatus = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);
export const OKRStatus = z.enum(["ON_TRACK", "AT_RISK", "BEHIND", "ACHIEVED"]);
export const RoadmapStatus = z.enum(["PLANNED", "IN_PROGRESS", "DONE"]);
export const CapabilityStatus = z.enum([
  "BACKLOG",
  "ANALYZING",
  "IMPLEMENTING",
  "DONE",
]);
export const IntegrationStatus = z.enum(["ACTIVE", "INACTIVE", "ERROR"]);
export const IntegrationType = z.enum([
  "jira",
  "azure-devops",
  "github",
  "slack",
]);
export const SupplierStatus = z.enum(["ACTIVE", "INACTIVE"]);
export const Priority = z.enum(["critical", "high", "medium", "low"]);
