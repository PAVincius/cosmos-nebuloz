"use server";

import { withTenantDb } from "@repo/database";
import { hasCharterPermission } from "@repo/rbac";
import { z } from "zod";
import { CAPABILITIES, getCapability } from "@/lib/charter/capabilities";
import { planejarTransporte } from "@/lib/charter/coverage-transfer";
import {
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
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
  status:
    | "ATENDE"
    | "PARCIAL"
    | "NAO_ATENDE"
    | "SEM_VEREDITO"
    | "REVISAR"
    | "NAO_APLICAVEL";
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

// ── Nova versão do conjunto ──────────────────────────────────────────────────

const PublishVersionSchema = z.object({
  supersedesId: z.string().min(1),
  nome: z.string().min(1).max(200),
  versao: z.string().min(1),
  requisitos: z.array(RequisitoSchema).min(1),
});

export async function publishSetVersion(
  input: z.input<typeof PublishVersionSchema>
): Promise<Result<{ id: string; afetadas: number }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("compliance.edit");
    const data = PublishVersionSchema.parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      // Do tenant OU global — mesmo filtro de getComplianceMap/setCoverage: o
      // conjunto superado pode ser uma regulação (tenantId null).
      const oldSet = await db.charterRequirementSet.findFirst({
        where: {
          id: data.supersedesId,
          OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
        },
      });
      if (!oldSet) {
        throw new GovernanceError(
          "set.unknown",
          "Conjunto de exigências não encontrado."
        );
      }

      // Licença é do conjunto, herdada pela nova versão — não perguntada de
      // novo. Sem isso, uma regulação REFERENCIA (ex.: ISO/IEC 42001) vira
      // LIVRE só por publicar versão em vez de importar, e o guard de
      // copyright de importRequirementSet nunca dispara de novo.
      if (
        oldSet.licenca === "REFERENCIA" &&
        data.requisitos.some((r) => r.texto)
      ) {
        throw new GovernanceError(
          "req.licenca",
          "Conjunto REFERENCIA não pode reproduzir texto de norma proprietária — use apenas citação e resumo."
        );
      }

      const oldRequisitos = await db.charterRequirement.findMany({
        where: { setId: oldSet.id },
        orderBy: { codigo: "asc" },
      });

      const newSet = await db.charterRequirementSet.create({
        data: {
          tenantId: ctx.tenantId,
          nome: data.nome,
          origem: oldSet.origem,
          editor: oldSet.editor,
          licenca: oldSet.licenca,
          jurisdicao: oldSet.jurisdicao,
          versao: data.versao,
          supersedesId: oldSet.id,
        },
      });

      await db.charterRequirement.createMany({
        data: data.requisitos.map((r) => ({
          setId: newSet.id,
          codigo: r.codigo,
          citacao: r.citacao,
          resumo: r.resumo,
          texto: r.texto ?? null,
          peso: r.peso ?? null,
          categoria: r.categoria ?? null,
        })),
      });

      // createMany não devolve os ids gerados — sem reler, não haveria como
      // saber em qual requisito da versão nova gravar a cobertura
      // transportada abaixo.
      const newRequisitos = await db.charterRequirement.findMany({
        where: { setId: newSet.id },
        orderBy: { codigo: "asc" },
      });
      const newByCode = new Map(newRequisitos.map((n) => [n.codigo, n]));

      // Diff por código: mudou quando resumo OU texto difere do mesmo código
      // no conjunto anterior; novo quando o código não existia; removido
      // quando sumiu. citacao fica de fora da comparação de propósito — só o
      // formato da referência mudar não altera a obrigação em si.
      const oldByCode = new Map(
        oldRequisitos.map((anterior) => [anterior.codigo, anterior])
      );
      const payloadCodes = new Set(data.requisitos.map((r) => r.codigo));

      let alteradas = 0;
      let novas = 0;
      const codigosMudados = new Set<string>();

      for (const r of data.requisitos) {
        const anterior = oldByCode.get(r.codigo);
        if (!anterior) {
          novas += 1;
          continue;
        }
        const mudou =
          anterior.resumo !== r.resumo ||
          (anterior.texto ?? null) !== (r.texto ?? null);
        if (mudou) {
          alteradas += 1;
          codigosMudados.add(r.codigo);
        }
      }

      const removidas = oldRequisitos.filter(
        (anterior) => !payloadCodes.has(anterior.codigo)
      );

      // Transportar cobertura para a versão nova. Os requisitos novos são
      // linhas com ids novos, e getComplianceMap busca cobertura por id de
      // requisito sem nunca percorrer supersedesId — sem transportar, todo
      // veredito (inclusive o que não mudou) some da vista no instante
      // seguinte à publicação.
      const oldIdToCode = new Map(
        oldRequisitos.map((anterior) => [anterior.id, anterior.codigo])
      );
      const oldCoverages = await db.charterCoverage.findMany({
        where: {
          tenantId: ctx.tenantId,
          requirementId: { in: oldRequisitos.map((anterior) => anterior.id) },
        },
      });

      const paraTransportar = planejarTransporte({
        tenantId: ctx.tenantId,
        coberturas: oldCoverages,
        idAnteriorParaCodigo: oldIdToCode,
        novoPorCodigo: newByCode,
        codigosMudados,
      });

      // Nunca criar cobertura onde não existia: ausência de linha já é
      // SEM_VEREDITO, e um insert aqui converteria "nunca avaliado" em
      // "avaliado e agora duvidoso" — afirmação que ninguém fez, e ainda
      // infla a contagem que o usuário lê.
      if (paraTransportar.length > 0) {
        await db.charterCoverage.createMany({ data: paraTransportar });
      }

      const afetadas = paraTransportar.filter(
        (c) => c.status === "REVISAR"
      ).length;

      await logCharterAudit(db, ctx, {
        action: "Publicou nova versão do conjunto de exigências",
        entityType: "charter.requirementset",
        entityId: newSet.id,
        target: `${data.nome} · v${data.versao}`,
        note: `v${data.versao} · ${alteradas} alterada, ${novas} nova, ${removidas.length} removida · ${paraTransportar.length} coberturas transportadas, ${afetadas} em revisão`,
      });

      return { id: newSet.id, afetadas };
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
    "NAO_APLICAVEL",
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
    // Simétrico invertido da regra acima. Lá, alegar conformidade exige
    // apontar a prova; aqui, descartar exige dizer por quê. "Não se aplica"
    // sem motivo é indistinguível de "não quis responder", e é o veredito
    // mais fácil de abusar num documento que vai para um comprador.
    if (data.status === "NAO_APLICAVEL" && !data.comentario) {
      throw new GovernanceError(
        "coverage.needs.reason",
        "Marcar como não aplicável exige dizer por quê."
      );
    }

    return withTenantDb(ctx.tenantId, async (db) => {
      // Do tenant OU global — mesmo filtro de getComplianceMap. Sem ele,
      // requirementId de outro tenant vira oráculo de existência: sucesso vs
      // violação de FK denuncia se o id existe em algum lugar do sistema,
      // ainda que CharterCoverage tenha RLS e a linha gravada carregue o
      // tenantId de quem chamou.
      const requirement = await db.charterRequirement.findFirst({
        where: {
          id: data.requirementId,
          set: { OR: [{ tenantId: ctx.tenantId }, { tenantId: null }] },
        },
      });
      if (!requirement) {
        throw new GovernanceError(
          "requirement.unknown",
          "Exigência não encontrada."
        );
      }

      // Pré-leitura pontual pela própria chave composta do upsert (indexada;
      // este é um caminho de escrita pouco frequente e disparado por
      // humano). Sem ela o diff de auditoria nunca saberia o veredito
      // anterior — e ATENDE → NAO_ATENDE é justamente o fato mais relevante
      // que esta tabela pode registrar.
      const anterior = await db.charterCoverage.findUnique({
        where: {
          tenantId_requirementId: {
            tenantId: ctx.tenantId,
            requirementId: data.requirementId,
          },
        },
      });

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
        diff: [["Status", anterior?.status ?? "—", data.status]],
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

    // Só as três leituras aqui dentro — set, requisitos, coberturas do
    // tenant. `withTenantDb` é um `$transaction`, e cada capacidade do
    // catálogo (`lib/charter/capabilities.ts`) abre seu **próprio**
    // `withTenantDb` para buscar a evidência. Resolver evidência aqui dentro
    // seguraria a conexão desta transação enquanto espera por uma segunda
    // conexão do mesmo pool para a transação interna — sob pool pequeno ou
    // serverless isso é a forma clássica de deadlock, e dispara em qualquer
    // mapa com pelo menos uma linha com capacidade. A leitura fecha (commit)
    // antes de qualquer `capability.evidencia()` ser chamada.
    const { set, requisitos, coberturas } = await withTenantDb(
      ctx.tenantId,
      async (db) => {
        // Do tenant OU global (tenantId null = regulação, vale para todos) —
        // nunca uma busca sem esse filtro, a única tabela sem RLS por baixo.
        const foundSet = await db.charterRequirementSet.findFirst({
          where: {
            id: setId,
            OR: [{ tenantId: ctx.tenantId }, { tenantId: null }],
          },
        });
        if (!foundSet) {
          // Mesma mensagem para "não existe" e "não é seu": distinguir
          // confirma ao curioso que o id existe em algum lugar.
          throw new GovernanceError(
            "set.unknown",
            "Conjunto de exigências não encontrado."
          );
        }

        const foundRequisitos = await db.charterRequirement.findMany({
          where: { setId: foundSet.id },
          orderBy: { codigo: "asc" },
        });

        const foundCoberturas = await db.charterCoverage.findMany({
          where: {
            tenantId: ctx.tenantId,
            requirementId: { in: foundRequisitos.map((r) => r.id) },
          },
        });

        return {
          set: foundSet,
          requisitos: foundRequisitos,
          coberturas: foundCoberturas,
        };
      }
    );

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
            // Fora da transação de leitura acima, de propósito — ver o
            // comentário no topo da função.
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

/**
 * Catálogo de capacidades, só `id` + `label` — o suficiente para o editor de
 * cobertura na tela oferecer opções. `evidencia` fica de fora de propósito:
 * ela chama `withTenantDb` (lib/charter/capabilities.ts é `server-only`) e
 * nunca deveria atravessar para o cliente, que só precisa saber que
 * capacidade existe, não como ela prova nada.
 */
export async function listCapabilities(): Promise<
  Result<{ id: string; label: string }[]>
> {
  return await safeAction(async () => {
    await requireCharterPermissionContext("compliance.map");
    return CAPABILITIES.map(({ id, label }) => ({ id, label }));
  });
}

// ── Permissão de edição ──────────────────────────────────────────────────────

export type ComplianceCan = { edit: boolean };

/**
 * Só a permissão do papel da sessão para definir veredito — não pode viver em
 * `ComplianceMap` (review final, Bloqueio "CoverageEditor sem gate"):
 * `compliance-export.ts` serializa o mapa inteiro num dos formatos
 * (`JSON.stringify(map)` no JSON, e o mesmo objeto alimenta CSV/PDF), e "quem
 * pode editar" não é dado de conformidade — vazaria a matriz de permissão do
 * tenant para um artefato que sai para o comprador. Por isso é uma action à
 * parte, no mesmo espírito de `listCapabilities()`: pequena, só o que a tela
 * cliente precisa, nunca passa perto do export.
 *
 * `requireCharterContext()`, não `requireCharterPermissionContext`: mesmo
 * padrão de `getPolicy()` (actions/policy.ts) — sessão + módulo + papel, sem
 * exigir uma permissão específica, porque o resultado É a permissão.
 */
export async function getComplianceCan(): Promise<Result<ComplianceCan>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    return { edit: hasCharterPermission(ctx.charterRole, "compliance.edit") };
  });
}
