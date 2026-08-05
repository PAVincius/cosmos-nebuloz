"use server";

import { withTenantDb } from "@repo/database";
import { z } from "zod";
import { getCapability } from "@/lib/charter/capabilities";
import { requireCharterPermissionContext } from "@/lib/charter/guards";
import { type Result, safeAction } from "../../actions/_base";
import { GovernanceError, logCharterAudit } from "./_shared";

// Mapa de conformidade — FR do RFP: importar exigências de um conjunto (RFP
// recebida ou regulação publicada pela Nebuloz) e registrar, por tenant, o
// veredito de cobertura sobre cada uma. `CharterRequirementSet` e
// `CharterRequirement` não têm RLS (DATA-MODEL): um conjunto de regulação
// carrega `tenantId: null` e vale para todos, e uma policy de RLS não
// consegue expressar "meu tenant OU nenhum" sem abrir brecha para um tenant
// fabricar uma linha "global". Toda leitura e escrita aqui filtra tenant à
// mão — é a única coisa impedindo a RFP de um cliente aparecer para outro.

export type MapRow = {
  requirementId: string;
  codigo: string;
  citacao: string;
  resumo: string;
  peso: number | null;
  status: "ATENDE" | "PARCIAL" | "NAO_ATENDE" | "SEM_VEREDITO" | "REVISAR";
  comentario: string | null;
  capabilityId: string | null;
  capabilityLabel: string | null;
  evidencia: { total: number; amostra: string[]; href?: string } | null;
  /** Preenchido quando a consulta de evidência falhou. A linha então não pode
   *  ser lida como prova — só como alegação. */
  evidenciaErro: string | null;
};

export type ComplianceMap = {
  setId: string;
  nome: string;
  linhas: MapRow[];
  semVeredito: number;
};

export type SetRow = {
  id: string;
  nome: string;
  origem: "RFP" | "REGULACAO";
  versao: string;
  total: number;
};

const RequisitoSchema = z.object({
  codigo: z.string().min(1).max(32),
  citacao: z.string().min(1).max(120),
  resumo: z.string().min(1),
  texto: z.string().optional(),
  peso: z.number().int().optional(),
  categoria: z.string().optional(),
});

const ImportSchema = z.object({
  nome: z.string().min(1).max(200),
  origem: z.enum(["RFP", "REGULACAO"]),
  editor: z.enum(["TENANT", "NEBULOZ"]).default("TENANT"),
  licenca: z.enum(["LIVRE", "REFERENCIA"]).default("LIVRE"),
  jurisdicao: z.string().optional(),
  versao: z.string().default("1"),
  notas: z.string().optional(),
  requisitos: z.array(RequisitoSchema).min(1),
});

// ── Importar conjunto ───────────────────────────────────────────────────────

export async function importRequirementSet(
  input: z.input<typeof ImportSchema>
): Promise<Result<{ id: string; total: number }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("compliance.edit");
    const data = ImportSchema.parse(input);

    // Antes de qualquer escrita: colagem de RFP repete linha com frequência.
    // Adivinhar qual das duas vale é decidir, em nome do usuário, o que ele
    // vai responder a um comprador — por isso recusa nomeando a linha em vez
    // de deduplicar silenciosamente.
    const seen = new Set<string>();
    for (const r of data.requisitos) {
      if (seen.has(r.codigo)) {
        throw new GovernanceError(
          "req.duplicate",
          `Código repetido na importação: "${r.codigo}". Corrija antes de importar.`
        );
      }
      seen.add(r.codigo);
    }

    if (data.licenca === "REFERENCIA" && data.requisitos.some((r) => r.texto)) {
      throw new GovernanceError(
        "req.licenca",
        "Conjunto REFERENCIA não pode reproduzir texto de norma proprietária — use apenas citação e resumo."
      );
    }

    return withTenantDb(ctx.tenantId, async (db) => {
      const set = await db.charterRequirementSet.create({
        data: {
          tenantId: ctx.tenantId,
          nome: data.nome,
          origem: data.origem,
          editor: data.editor,
          licenca: data.licenca,
          jurisdicao: data.jurisdicao ?? null,
          versao: data.versao,
          notas: data.notas ?? null,
        },
      });

      await db.charterRequirement.createMany({
        data: data.requisitos.map((r) => ({
          setId: set.id,
          codigo: r.codigo,
          citacao: r.citacao,
          resumo: r.resumo,
          texto: r.texto ?? null,
          peso: r.peso ?? null,
          categoria: r.categoria ?? null,
        })),
      });

      await logCharterAudit(db, ctx, {
        action: "Importou conjunto de exigências",
        entityType: "charter.requirementset",
        entityId: set.id,
        target: `${data.nome} · ${data.requisitos.length} exigências`,
        diff: [["Exigências importadas", "—", String(data.requisitos.length)]],
      });

      return { id: set.id, total: data.requisitos.length };
    });
  });
}

// ── Definir cobertura ───────────────────────────────────────────────────────

const SetCoverageSchema = z.object({
  requirementId: z.string().min(1),
  status: z.enum([
    "ATENDE",
    "PARCIAL",
    "NAO_ATENDE",
    "SEM_VEREDITO",
    "REVISAR",
  ]),
  capabilityId: z.string().min(1).optional(),
  comentario: z.string().trim().max(2000).optional(),
});

export async function setCoverage(
  input: z.infer<typeof SetCoverageSchema>
): Promise<Result<null>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("compliance.edit");
    const data = SetCoverageSchema.parse(input);

    if (data.capabilityId && !getCapability(data.capabilityId)) {
      throw new GovernanceError(
        "coverage.capability.unknown",
        `Capacidade "${data.capabilityId}" não existe no catálogo.`
      );
    }
    if (
      (data.status === "ATENDE" || data.status === "PARCIAL") &&
      !data.capabilityId
    ) {
      throw new GovernanceError(
        "coverage.needs.capability",
        "Alegar conformidade exige apontar a capacidade que a prova."
      );
    }

    return withTenantDb(ctx.tenantId, async (db) => {
      // Chave composta: uma exigência de regulação é UMA linha global
      // compartilhada por todos os tenants (DATA-MODEL). `where: {
      // requirementId }` faria o upsert do segundo tenant a opinar
      // sobrescrever o veredito do primeiro, que sumiria da vista dele.
      await db.charterCoverage.upsert({
        where: {
          tenantId_requirementId: {
            tenantId: ctx.tenantId,
            requirementId: data.requirementId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          requirementId: data.requirementId,
          status: data.status,
          comentario: data.comentario ?? null,
          capabilityId: data.capabilityId ?? null,
        },
        update: {
          status: data.status,
          comentario: data.comentario ?? null,
          capabilityId: data.capabilityId ?? null,
        },
      });

      await logCharterAudit(db, ctx, {
        action: "Registrou cobertura",
        entityType: "charter.coverage",
        entityId: data.requirementId,
        target: `${data.requirementId} · ${data.status}`,
        // "Antes" fica "—": o upsert é de mão única (sem pré-leitura) de
        // propósito, para não gastar um round-trip extra num caminho que
        // roda a cada veredito. A linha prova quem registrou o quê e quando;
        // o valor anterior, quando existe, já está na entrada de auditoria
        // que este registro sucede.
        diff: [["Status", "—", data.status]],
      });

      return null;
    });
  });
}

// ── Mapa de conformidade ─────────────────────────────────────────────────────

export async function getComplianceMap(
  setId: string
): Promise<Result<ComplianceMap>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("compliance.map");

    return withTenantDb(ctx.tenantId, async (db) => {
      // Do tenant OU global (tenantId null = regulação, vale para todos) —
      // nunca uma busca sem esse filtro, a única tabela sem RLS por baixo.
      const set = await db.charterRequirementSet.findFirst({
        where: {
          id: setId,
          OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
        },
      });
      if (!set) {
        // Mesma mensagem para "não existe" e "não é seu": distinguir
        // confirma ao curioso que o id existe em algum lugar.
        throw new GovernanceError(
          "set.unknown",
          "Conjunto de exigências não encontrado."
        );
      }

      const requisitos = await db.charterRequirement.findMany({
        where: { setId: set.id },
        orderBy: { codigo: "asc" },
      });

      const coberturas = await db.charterCoverage.findMany({
        where: {
          tenantId: ctx.tenantId,
          requirementId: { in: requisitos.map((r) => r.id) },
        },
      });
      const coberturaPorRequisito = new Map(
        coberturas.map((c) => [c.requirementId, c])
      );

      let semVeredito = 0;
      const linhas: MapRow[] = [];
      for (const r of requisitos) {
        const cobertura = coberturaPorRequisito.get(r.id);
        const status = cobertura?.status ?? "SEM_VEREDITO";
        if (status === "SEM_VEREDITO") {
          semVeredito += 1;
        }

        let evidencia: MapRow["evidencia"] = null;
        let evidenciaErro: string | null = null;
        let capabilityLabel: string | null = null;

        if (cobertura?.capabilityId) {
          const capability = getCapability(cobertura.capabilityId);
          if (capability) {
            capabilityLabel = capability.label;
            try {
              evidencia = await capability.evidencia(ctx.tenantId);
            } catch (e) {
              // O mapa nunca pode seguir mostrando "atende" limpo sem
              // conseguir provar: uma linha que afirma sem provar vai para o
              // comprador com a chancela do produto.
              evidenciaErro =
                e instanceof Error
                  ? `Falha ao buscar evidência: ${e.message}`
                  : "Falha ao buscar evidência.";
            }
          } else {
            evidenciaErro =
              "Capacidade removida do catálogo — revise esta cobertura.";
          }
        }

        linhas.push({
          requirementId: r.id,
          codigo: r.codigo,
          citacao: r.citacao,
          resumo: r.resumo,
          peso: r.peso,
          status,
          comentario: cobertura?.comentario ?? null,
          capabilityId: cobertura?.capabilityId ?? null,
          capabilityLabel,
          evidencia,
          evidenciaErro,
        });
      }

      return { setId: set.id, nome: set.nome, linhas, semVeredito };
    });
  });
}

// ── Listagem ──────────────────────────────────────────────────────────────────

export async function listRequirementSets(): Promise<Result<SetRow[]>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("compliance.map");

    return withTenantDb(ctx.tenantId, async (db) => {
      // Do tenant OU global — mesmo cuidado de getComplianceMap: esta tabela
      // não tem RLS, então "todos os conjuntos" sem o OR vazaria RFP entre
      // tenants.
      const sets = await db.charterRequirementSet.findMany({
        where: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] },
        include: { _count: { select: { requirements: true } } },
        orderBy: { importadoEm: "desc" },
      });

      return sets.map((s) => ({
        id: s.id,
        nome: s.nome,
        origem: s.origem,
        versao: s.versao,
        total: s._count.requirements,
      }));
    });
  });
}
