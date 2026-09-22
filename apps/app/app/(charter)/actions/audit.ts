"use server";

import { withTenantDb } from "@repo/database";
import { z } from "zod";
import {
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import {
  diffDeSnapshots,
  diffSecoesParaTexto,
  snapshotSections,
  type VersionDiffRow,
} from "@/lib/charter/version-diff";
import { type Result, safeAction } from "../../actions/_base";
import { type AuditDiff, FIELD_LABELS, logCharterAudit } from "./_shared";
import {
  ACAO_PUBLICOU_VERSAO,
  AUDIT_CATEGORY,
  CHARTER_ENTITY_TYPES as ENTITY_TYPES,
} from "./audit.constants";

// Auditoria — FR-11. Append-only: sem update, sem delete, por nenhum papel.
// A imutabilidade é garantida no banco (trigger da migration
// 20260603000002_audit_log_immutable_trigger), não por convenção de código.

export type AuditRow = {
  id: string;
  type: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  when: string;
  note: string | null;
  diff: AuditDiff | null;
};

type AuditMeta = {
  target?: string;
  note?: string | null;
  charterRole?: string;
  actorName?: string | null;
};

const ListSchema = z.object({
  category: z.string().optional(),
  actor: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(500).default(200),
});

export async function listAudit(
  input: z.input<typeof ListSchema> = {}
): Promise<Result<{ rows: AuditRow[]; actors: string[] }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("audit.read");
    const f = ListSchema.parse(input);

    const wanted =
      f.category && f.category !== "all"
        ? ENTITY_TYPES.filter((t) => AUDIT_CATEGORY[t] === f.category)
        : [...ENTITY_TYPES];

    return withTenantDb(ctx.tenantId, async (db) => {
      const entries = await db.auditLog.findMany({
        where: {
          tenantId: ctx.tenantId,
          entityType: { in: wanted },
          ...(f.from || f.to
            ? {
                createdAt: {
                  ...(f.from ? { gte: f.from } : {}),
                  ...(f.to ? { lte: f.to } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: f.limit,
      });

      const rows: AuditRow[] = entries.map((e) => {
        const meta = (e.metadata ?? {}) as AuditMeta;
        return {
          id: e.id,
          type: AUDIT_CATEGORY[e.entityType ?? ""] ?? "policy",
          actor: meta.actorName ?? e.actorId ?? "—",
          role: meta.charterRole ?? "—",
          action: e.action,
          target: meta.target ?? e.entityId ?? "—",
          when: e.createdAt.toISOString(),
          note: meta.note ?? null,
          diff: (e.diff as AuditDiff | null) ?? null,
        };
      });

      const filtered =
        f.actor && f.actor !== "all"
          ? rows.filter((r) => r.actor === f.actor)
          : rows;

      return {
        rows: filtered,
        actors: [...new Set(rows.map((r) => r.actor))].filter((a) => a !== "—"),
      };
    });
  });
}

// ── Exportação de evidência (FR-11.5, FR-11.6) ────────────────────────────────

const ExportSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  categories: z.array(z.string()).min(1, "Selecione ao menos uma categoria"),
  format: z.enum(["csv", "json"]).default("csv"),
});

export type ExportPackage = {
  filename: string;
  mimeType: string;
  content: string;
  recordCount: number;
};

/**
 * Linha do pacote: a linha da trilha mais o diff real das seções, derivado dos
 * snapshots. `AuditRow` fica intocado — é o contrato da tela de auditoria.
 */
export type ExportRow = AuditRow & {
  /** Só em publicação de versão de política. Ausente nos demais eventos. */
  sections?: VersionDiffRow[];
};

/**
 * O que vai na coluna `diff`. Os campos do evento continuam como eram
 * (`Campo: antes → depois`, separados por ` | `); a publicação de versão ganha
 * abaixo deles o diff das seções, um bloco por seção. Célula multilinha entre
 * aspas é CSV válido (RFC 4180) e o Excel abre certo.
 */
function celulaDeDiff(r: ExportRow): string {
  const campos = (r.diff ?? [])
    .map(([f, b, a]) => `${f}: ${b} → ${a}`)
    .join(" | ");
  if (!r.sections?.length) {
    return campos;
  }
  const secoes = diffSecoesParaTexto(r.sections);
  return campos ? `${campos}\n\n${secoes}` : secoes;
}

function toCsv(rows: ExportRow[]): string {
  // Sempre entre aspas: com as aspas internas dobradas, quebra de linha e
  // vírgula dentro da célula deixam de ser separador.
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "id",
    "quando",
    "categoria",
    "ator",
    "papel",
    "acao",
    "alvo",
    "nota",
    "diff",
  ];
  const lines = rows.map((r) =>
    [
      r.id,
      r.when,
      r.type,
      r.actor,
      r.role,
      r.action,
      r.target,
      r.note ?? "",
      celulaDeDiff(r),
    ]
      .map(esc)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

type EntradaDeTrilha = {
  action: string;
  entityType: string | null;
  entityId: string | null;
  diff: unknown;
};

/** Versão publicada, lida do próprio diff do evento. */
function versaoDoEvento(e: EntradaDeTrilha): string | null {
  if (e.entityType !== "charter.policy" || !e.entityId) {
    return null;
  }
  const diff = (e.diff as AuditDiff | null) ?? null;
  return diff?.find(([f]) => f === FIELD_LABELS.version)?.[2] ?? null;
}

/**
 * Compila o pacote de evidência e **grava a si mesmo** na trilha (FR-11.6).
 * Sem isso, a exportação — o momento em que dados de governança saem do
 * sistema — seria a única ação sem rastro.
 *
 * Reproduzível: mesmo período e escopo → mesmo conteúdo (NFR-5.3). Por isso a
 * ordenação é determinística e nada depende do relógio além do filtro. Vale
 * também para o diff de seções: ele sai de `snapshot`, que é imutável, e o
 * antecessor de uma versão não muda quando outra é publicada depois.
 *
 * O diff é derivado aqui, não lido de um campo gravado na publicação. O
 * snapshot da versão já é o registro do que foi publicado; gravar o texto das
 * seções também no evento guardaria o mesmo conteúdo uma terceira vez no
 * banco, e duas cópias divergem. Era essa a origem do defeito: o evento só
 * tinha contagem ("Seções alteradas: — → 9") e o auditor recebia a contagem.
 */
export async function exportEvidence(
  input: z.input<typeof ExportSchema>
): Promise<Result<ExportPackage>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("audit.export");
    const f = ExportSchema.parse(input);

    const wanted = ENTITY_TYPES.filter((t) =>
      f.categories.includes(AUDIT_CATEGORY[t])
    );

    return withTenantDb(ctx.tenantId, async (db) => {
      const entries = await db.auditLog.findMany({
        where: {
          tenantId: ctx.tenantId,
          entityType: { in: wanted },
          createdAt: { gte: f.from, lte: f.to },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      // As versões das políticas publicadas no período, na ordem em que foram
      // publicadas: é dela que sai o antecessor de cada versão.
      const publicacoes = entries.filter(
        (e) => e.action === ACAO_PUBLICOU_VERSAO && versaoDoEvento(e)
      );
      const policyIds = [
        ...new Set(publicacoes.map((e) => e.entityId as string)),
      ].sort();
      const versions = policyIds.length
        ? await db.charterPolicyVersion.findMany({
            where: { tenantId: ctx.tenantId, policyId: { in: policyIds } },
            orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
            select: { policyId: true, version: true, snapshot: true },
          })
        : [];
      const versoesPorPolitica = new Map<string, typeof versions>();
      for (const v of versions) {
        const lista = versoesPorPolitica.get(v.policyId) ?? [];
        lista.push(v);
        versoesPorPolitica.set(v.policyId, lista);
      }

      const secoesDoEvento = (
        e: EntradaDeTrilha
      ): VersionDiffRow[] | undefined => {
        const versao = versaoDoEvento(e);
        if (e.action !== ACAO_PUBLICOU_VERSAO || !versao) {
          return;
        }
        const lista = versoesPorPolitica.get(e.entityId as string);
        const i = lista?.findIndex((v) => v.version === versao) ?? -1;
        if (!lista || i < 0) {
          return;
        }
        // `lista[-1]` é undefined: primeira publicação compara contra nada e
        // todas as seções saem como novas, que é o que aconteceu.
        return diffDeSnapshots(
          snapshotSections(lista[i - 1]?.snapshot),
          snapshotSections(lista[i].snapshot)
        );
      };

      const rows: ExportRow[] = entries.map((e) => {
        const meta = (e.metadata ?? {}) as AuditMeta;
        const sections = secoesDoEvento(e);
        return {
          id: e.id,
          type: AUDIT_CATEGORY[e.entityType ?? ""] ?? "policy",
          actor: meta.actorName ?? e.actorId ?? "—",
          role: meta.charterRole ?? "—",
          action: e.action,
          target: meta.target ?? e.entityId ?? "—",
          when: e.createdAt.toISOString(),
          note: meta.note ?? null,
          diff: (e.diff as AuditDiff | null) ?? null,
          ...(sections ? { sections } : {}),
        };
      });

      const period = `${f.from.toISOString().slice(0, 10)}_${f.to
        .toISOString()
        .slice(0, 10)}`;

      // A própria exportação vira entrada — quem, período, escopo.
      await logCharterAudit(db, ctx, {
        action: "Exportou pacote",
        entityType: "charter.export",
        entityId: ctx.tenantId,
        target: `Evidência ${period}`,
        note: `${rows.length} registros · categorias: ${f.categories.join(", ")} · formato ${f.format.toUpperCase()}`,
      });

      return {
        filename: `charter-evidencia-${period}.${f.format}`,
        mimeType: f.format === "csv" ? "text/csv" : "application/json",
        content:
          f.format === "csv" ? toCsv(rows) : JSON.stringify(rows, null, 2),
        recordCount: rows.length,
      };
    });
  });
}

/** Trilha de um alvo específico, para o painel de auditoria do caso (FR-5.7). */
export async function listAuditForEntity(
  entityId: string
): Promise<Result<AuditRow[]>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return withTenantDb(ctx.tenantId, async (db) => {
      const entries = await db.auditLog.findMany({
        where: { tenantId: ctx.tenantId, entityId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return entries.map((e) => {
        const meta = (e.metadata ?? {}) as AuditMeta;
        return {
          id: e.id,
          type: AUDIT_CATEGORY[e.entityType ?? ""] ?? "policy",
          actor: meta.actorName ?? e.actorId ?? "—",
          role: meta.charterRole ?? "—",
          action: e.action,
          target: meta.target ?? e.entityId ?? "—",
          when: e.createdAt.toISOString(),
          note: meta.note ?? null,
          diff: (e.diff as AuditDiff | null) ?? null,
        };
      });
    });
  });
}
