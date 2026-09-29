"use server";

import type { ScaffoldPhase, ScaffoldPhaseState } from "@repo/database";
import { withTenantDb } from "@repo/database";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { deliverableProgress } from "@/lib/scaffold/deliverable-progress";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import { upsertProcessRegistry } from "@/lib/scaffold/process-registry";
import {
  CancelTrackSchema,
  CreateTrackFromGapSchema,
  CreateTrackSchema,
  ListTracksSchema,
  TrackIdSchema,
} from "@/lib/scaffold/schemas";
import {
  DEFAULT_STALL_THRESHOLD_DAYS,
  isStalled,
  overrideRate,
  stalledDays,
} from "@/lib/scaffold/stall";
import { seedTrack } from "./_seed-track";
import { logScaffoldAudit } from "./_shared";

// Trilhas do Scaffold (S-01, S-07).
//
// A criação é o ponto em que o método vira trabalho: a versão do template é
// PINADA e nunca migra (ST-03), e os textos de passo são COPIADOS em vez de
// lidos por join — ver `_seed-track.ts`, que as duas actions de criação
// compartilham.

export type TrackSummary = {
  id: string;
  code: string;
  processName: string;
  archetype: string | null;
  currentPhase: ScaffoldPhase;
  phaseState: ScaffoldPhaseState;
  status: string;
  ownerId: string;
  ownerName: string | null;
  consultantId: string | null;
  templateLabel: string;
  sourceGapId: string | null;
  startedAt: Date;
  lastGateAt: Date | null;
  lastGateLabel: string | null;
  stalledDays: number;
  /** Aprovados sobre obrigatórios ("3/16 entregáveis"). 0/0 = trilha anterior
   *  ao modelo de entregáveis: a tela não mostra fração. */
  deliverables: { approved: number; required: number };
};

/** Taxa de override por recorte — SG-08. */
export type OverrideRate = {
  label: string;
  closed: number;
  overridden: number;
  rate: number;
};

/** Lacuna do Meridian promovida para o Scaffold e ainda sem trilha — S-01. É
 *  a fila de entrada do portfólio: promoção sem trilha é promessa sem dono. */
export type PendingPromotion = {
  id: string;
  gapId: string;
  gapCode: string;
  statement: string;
  promotedAt: Date;
};

export type ScaffoldMember = { id: string; name: string; role: string };

/**
 * O portfólio inteiro numa chamada.
 *
 * Os agregados vêm junto da lista de propósito: calculá-los no cliente
 * obrigaria a carregar toda trilha para contar quatro números, e paginar depois
 * quebraria a contagem em silêncio.
 */
export type PortfolioSummary = {
  tracks: TrackSummary[];
  pendingPromotions: PendingPromotion[];
  /** Quem pode ser dono ou consultor de uma trilha nova. */
  members: ScaffoldMember[];
  embeddedCount: number;
  stalledCount: number;
  gateReadyCount: number;
  signedBaselineCount: number;
  orgCount: number;
  stallThresholdDays: number;
  overrideRates: OverrideRate[];
};

/** Limiar default de estagnação (S-09), espelhando
 *  `ScaffoldSettings.stallThresholdDays`. */
/** Dias inteiros desde o último movimento de gate. Trilha sem gate nenhum conta
 *  a partir do início — uma trilha parada desde o primeiro dia está parada. */
function stalledDaysFrom(lastGateAt: Date | null, startedAt: Date): number {
  const since = (lastGateAt ?? startedAt).getTime();
  return Math.floor((Date.now() - since) / 86_400_000);
}

/**
 * S-01 — trilha semeada a partir de uma lacuna do Meridian.
 *
 * Esta é a ligação que faltava: `MeridianGapPromotion.targetEntityId` era nulo
 * porque o produto de destino não existia no repositório. Aqui ele passa a
 * apontar para a trilha.
 *
 * A direção do acoplamento é deliberada — o Scaffold lê o Meridian, e não o
 * contrário. `promoteGap` continua registrando só a intenção: fazê-la criar a
 * trilha exigiria que quem promove tivesse papel de Scaffold e que o tenant
 * tivesse o módulo contratado, e uma promoção não pode falhar porque o outro
 * produto não foi comprado.
 */
export async function createTrackFromGap(
  raw: z.input<typeof CreateTrackFromGapSchema>
): Promise<ScaffoldResult<{ trackId: string; code: string }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("track.manage");
    const input = CreateTrackFromGapSchema.parse(raw);

    const track = await withTenantDb(ctx.tenantId, async (db) => {
      const promotion = await db.meridianGapPromotion.findFirst({
        where: {
          id: input.promotionId,
          tenantId: ctx.tenantId,
          gapId: input.gapId,
          revokedAt: null,
        },
        select: { id: true, targetEntityId: true, targetProduct: true },
      });
      if (!promotion) {
        throw new ScaffoldRuleError("GAP_ALREADY_PROMOTED");
      }
      // Promoção que já aterrissou não aterrissa de novo. Duas trilhas para a
      // mesma lacuna esconderiam qual delas o diagnóstico está esperando.
      if (promotion.targetEntityId) {
        throw new ScaffoldRuleError("GAP_ALREADY_PROMOTED");
      }

      const created = await seedTrack(db, {
        tenantId: ctx.tenantId,
        processName: input.processName,
        ownerId: input.ownerId,
        authorId: ctx.userId,
        consultantId: input.consultantId,
        archetype: input.archetype,
        templateId: input.templateId,
        overlayId: input.overlayId,
        sourceGapId: input.gapId,
        sourcePromotionId: promotion.id,
      });

      await db.meridianGapPromotion.update({
        where: { id: promotion.id },
        data: { targetEntityId: created.id },
      });

      // X-01. Sem isto o registro único de processo nasce vazio: é aqui que gap e
      // trilha se encontram. Na mesma transação — trilha sem vínculo é o estado
      // que o registro existe para evitar.
      await upsertProcessRegistry(db, {
        tenantId: ctx.tenantId,
        name: input.processName,
        workForm: input.archetype ?? null,
        meridianGapId: input.gapId,
        scaffoldTrackId: created.id,
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.track.create-from-gap",
        entityType: "scaffold.track",
        entityId: created.id,
        target: `${created.code} · ${input.processName}`,
        note: `Semeada da lacuna ${input.gapId}; promoção ${promotion.id} passou a apontar para a trilha. Caso de negócio ${created.businessCaseCode} aberto em rascunho (v1).`,
      });

      return created;
    });

    revalidatePath("/scaffold");
    revalidatePath("/meridian");
    return { trackId: track.id, code: track.code };
  });
}

/** Trilha sem lacuna de origem. Existe porque nem todo processo que merece
 *  trilha passou por diagnóstico — e obrigar um diagnóstico só para abrir a
 *  trilha inventaria trabalho. */
export async function createTrack(
  raw: z.input<typeof CreateTrackSchema>
): Promise<ScaffoldResult<{ trackId: string; code: string }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("track.manage");
    const input = CreateTrackSchema.parse(raw);

    const track = await withTenantDb(ctx.tenantId, async (db) => {
      const created = await seedTrack(db, {
        tenantId: ctx.tenantId,
        processName: input.processName,
        ownerId: input.ownerId,
        authorId: ctx.userId,
        consultantId: input.consultantId,
        archetype: input.archetype,
        templateId: input.templateId,
        overlayId: input.overlayId,
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.track.create",
        entityType: "scaffold.track",
        entityId: created.id,
        target: `${created.code} · ${input.processName}`,
        note: `Caso de negócio ${created.businessCaseCode} aberto em rascunho (v1).`,
      });
      return created;
    });

    revalidatePath("/scaffold");
    return { trackId: track.id, code: track.code };
  });
}

/** Data curta pt-BR ("12 jul"), como o protótipo mostra. Ano só quando não é
 *  o corrente — "12 jul 2025" num portfólio de 2026 é informação; em 2026 é
 *  ruído em toda linha. */
function shortDate(d: Date | null): string | null {
  if (!d) {
    return null;
  }
  const now = new Date();
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * S-07 — portfólio, com os agregados que a tela mostra.
 *
 * `stalledDays` é derivado na leitura, não coluna: ele muda todo dia sozinho, e
 * coluna que muda sem ninguém escrever é coluna errada.
 */
export async function listTracks(
  raw: z.input<typeof ListTracksSchema> = {}
): Promise<ScaffoldResult<PortfolioSummary>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("portfolio.read");
    const input = ListTracksSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const [rows, settings, gateResults, promotions, memberships] =
        await Promise.all([
          db.scaffoldTrack.findMany({
            where: {
              tenantId: ctx.tenantId,
              ...(input.status ? { status: input.status } : {}),
              ...(input.phase ? { currentPhase: input.phase } : {}),
              ...(input.archetype ? { archetype: input.archetype } : {}),
              ...(input.ownerId ? { ownerId: input.ownerId } : {}),
            },
            orderBy: [{ lastGateAt: "asc" }, { startedAt: "asc" }],
            select: {
              id: true,
              code: true,
              processName: true,
              archetype: true,
              currentPhase: true,
              status: true,
              ownerId: true,
              consultantId: true,
              sourceGapId: true,
              startedAt: true,
              lastGateAt: true,
              templateVersion: { select: { label: true } },
              phases: { select: { phase: true, state: true } },
              businessCase: { select: { signedVersionId: true } },
            },
          }),
          db.scaffoldSettings.findUnique({
            where: { tenantId: ctx.tenantId },
            select: { stallThresholdDays: true },
          }),
          // SG-08: a taxa sai dos resultados de gate, não de um contador na
          // trilha — contador desincronizaria do registro append-only, e o
          // registro é a evidência.
          db.scaffoldGateResult.groupBy({
            by: ["outcome"],
            where: { tenantId: ctx.tenantId },
            _count: { _all: true },
          }),
          // S-01: promoção do Meridian que ainda não virou trilha. Lida daqui, e
          // não de uma action do Meridian, porque é o Scaffold que a consome —
          // mesma tabela, mesmo tenant, sem travessia.
          db.meridianGapPromotion.findMany({
            where: {
              tenantId: ctx.tenantId,
              targetProduct: "SCAFFOLD",
              targetEntityId: null,
              revokedAt: null,
            },
            orderBy: { promotedAt: "asc" },
            select: {
              id: true,
              gapId: true,
              promotedAt: true,
              gap: { select: { code: true, statement: true } },
            },
          }),
          db.scaffoldMembership.findMany({
            where: { tenantId: ctx.tenantId },
            select: { userId: true, role: true },
          }),
        ]);

      // `ownerId` não tem FK (o dono é usuário da plataforma, a trilha é do
      // tenant), então o nome vem numa segunda consulta em vez de join. A
      // mesma consulta resolve os membros: quem pode ser dono de trilha nova.
      const userIds = [
        ...new Set([
          ...rows.map((t) => t.ownerId),
          ...memberships.map((m) => m.userId),
        ]),
      ];
      const owners = userIds.length
        ? await db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const ownerName = new Map(
        owners.map((u) => [u.id, u.name ?? u.email ?? null])
      );

      // Progresso de entregáveis de todas as trilhas listadas, numa consulta.
      const deliverables = rows.length
        ? await db.scaffoldDeliverableInstance.findMany({
            where: {
              tenantId: ctx.tenantId,
              trackId: { in: rows.map((t) => t.id) },
            },
            select: {
              trackId: true,
              code: true,
              status: true,
              required: true,
            },
          })
        : [];

      const threshold =
        settings?.stallThresholdDays ?? DEFAULT_STALL_THRESHOLD_DAYS;

      const tracks = rows.map((t): TrackSummary => {
        const current = t.phases.find((p) => p.phase === t.currentPhase);
        return {
          id: t.id,
          code: t.code,
          processName: t.processName,
          archetype: t.archetype,
          currentPhase: t.currentPhase,
          phaseState: current?.state ?? "IDLE",
          status: t.status,
          ownerId: t.ownerId,
          ownerName: ownerName.get(t.ownerId) ?? null,
          consultantId: t.consultantId,
          templateLabel: t.templateVersion.label,
          sourceGapId: t.sourceGapId,
          startedAt: t.startedAt,
          lastGateAt: t.lastGateAt,
          lastGateLabel: shortDate(t.lastGateAt),
          stalledDays: stalledDays(t.lastGateAt, t.startedAt),
          deliverables: deliverableProgress(
            deliverables.filter((d) => d.trackId === t.id),
            Boolean(t.businessCase?.signedVersionId)
          ),
        };
      });

      const closed = gateResults.reduce((n, g) => n + g._count._all, 0);
      const overridden =
        gateResults.find((g) => g.outcome === "OVERRIDDEN")?._count._all ?? 0;
      const rate = overrideRate({ closed, overridden });

      return {
        tracks,
        pendingPromotions: promotions.map((p) => ({
          id: p.id,
          gapId: p.gapId,
          gapCode: p.gap.code,
          statement: p.gap.statement,
          promotedAt: p.promotedAt,
        })),
        members: memberships.map((m) => ({
          id: m.userId,
          name: ownerName.get(m.userId) ?? m.userId,
          role: m.role,
        })),
        embeddedCount: tracks.filter((t) => t.status === "EMBEDDED").length,
        stalledCount: tracks.filter((t) => isStalled(t.stalledDays, threshold))
          .length,
        gateReadyCount: tracks.filter((t) => t.phaseState === "GATE_READY")
          .length,
        signedBaselineCount: rows.filter((t) => t.businessCase?.signedVersionId)
          .length,
        orgCount: tracks.length,
        stallThresholdDays: threshold,
        overrideRates:
          rate === null
            ? []
            : [{ label: "Esta organização", closed, overridden, rate }],
      };
    });
  });
}

export type TrackDetailStep = {
  id: string;
  seq: number;
  statement: string;
  expectedArtefact: string;
  required: boolean;
  state: string;
  completedAt: Date | null;
  artefacts: { id: string; filename: string; sizeBytes: number }[];
};

export type TrackDetailPhase = {
  id: string;
  phase: ScaffoldPhase;
  state: ScaffoldPhaseState;
  openedAt: Date | null;
  closedAt: Date | null;
  observationEndsAt: Date | null;
  reopenCount: number;
  reopenCountAtClose: number;
  charterPolicyAckAt: Date | null;
  /** S-11 — política do Charter aplicável a esta fase. Nula quando o Charter
   *  não está contratado: SRD §8 manda degradar, não bloquear. */
  charterPolicy: {
    id: string;
    name: string;
    version: string | null;
    scope: string | null;
  } | null;
  /** Políticas publicadas disponíveis para vincular. Vazio sem Charter. */
  charterAvailable: { id: string; name: string; version: string | null }[];
  steps: TrackDetailStep[];
  criteria: { key: string; statement: string; evaluationType: string }[];
  /** Último resultado de gate desta fase, se houver. Append-only: o que a tela
   *  mostra é o topo da pilha, não a única linha (SG-07). */
  result: {
    outcome: string;
    decidedAt: Date;
    cycle: number;
    criteriaSnapshot: unknown;
    override: {
      actorId: string;
      unmetCriteria: string[];
      rationale: string;
      createdAt: Date;
    } | null;
  } | null;
};

export type TrackDetail = {
  id: string;
  code: string;
  processName: string;
  archetype: string | null;
  status: string;
  currentPhase: ScaffoldPhase;
  startedAt: Date;
  templateLabel: string;
  templateName: string;
  /** Quem assina o gate por default — ver `closeGate` na tela. */
  ownerId: string;
  ownerName: string | null;
  consultantName: string | null;
  sourceGap: { code: string; statement: string } | null;
  businessCase: {
    id: string;
    code: string;
    state: string;
    signed: boolean;
  } | null;
  phases: TrackDetailPhase[];
};

/** Detalhe da trilha, com tudo que o stepper e o painel de gate precisam. */
export async function getTrack(
  raw: z.input<typeof TrackIdSchema>
): Promise<ScaffoldResult<TrackDetail>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("portfolio.read");
    const input = TrackIdSchema.parse(raw);

    return withTenantDb(ctx.tenantId, async (db) => {
      const track = await db.scaffoldTrack.findFirst({
        // tenantId no where, sempre: o id sozinho é adivinhável e a RLS é a
        // segunda linha de defesa, não a primeira.
        where: { id: input.trackId, tenantId: ctx.tenantId },
        include: {
          templateVersion: {
            select: {
              id: true,
              label: true,
              template: { select: { name: true } },
              criteria: {
                orderBy: { seq: "asc" },
                select: {
                  phase: true,
                  key: true,
                  statement: true,
                  evaluationType: true,
                },
              },
            },
          },
          businessCase: {
            select: {
              id: true,
              code: true,
              state: true,
              signedVersionId: true,
            },
          },
          phases: {
            orderBy: { phase: "asc" },
            include: {
              steps: {
                orderBy: { seq: "asc" },
                include: {
                  artefacts: {
                    orderBy: { uploadedAt: "asc" },
                    select: { id: true, filename: true, sizeBytes: true },
                  },
                },
              },
              // `take: 1` com ordem decrescente de ciclo: a tela mostra a
              // decisão vigente. O histórico completo é do relatório, não do
              // painel — mas ele existe, e é isso que SG-07 garante.
              results: {
                orderBy: { cycle: "desc" },
                take: 1,
                include: { override: true },
              },
            },
          },
        },
      });
      if (!track) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }

      // S-11 / SG-05 — o Charter pode não estar contratado. `hasCharter` é o
      // que decide entre "vincular política" e "seção some da tela": mostrar um
      // seletor vazio prometeria integração que o tenant não comprou.
      const charterModule = await db.tenantModule.findFirst({
        where: {
          tenantId: ctx.tenantId,
          module: "CHARTER",
          status: { in: ["ACTIVE", "TRIAL"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { module: true },
      });
      const charterPolicies = charterModule
        ? await db.charterPolicy.findMany({
            where: { tenantId: ctx.tenantId, publishedAt: { not: null } },
            orderBy: { name: "asc" },
            select: { id: true, name: true, version: true, scope: true },
          })
        : [];

      const peopleIds = [track.ownerId, track.consultantId].filter(
        (id): id is string => Boolean(id)
      );
      const people = await db.user.findMany({
        where: { id: { in: peopleIds } },
        select: { id: true, name: true, email: true },
      });
      const nameOf = (id: string | null) => {
        if (!id) {
          return null;
        }
        const u = people.find((x) => x.id === id);
        return u?.name ?? u?.email ?? null;
      };

      // A lacuna de origem vive do lado do Meridian e é lida por id — não há
      // relação, de propósito (ver o modelo). Ausência é normal: trilha pode
      // nascer sem diagnóstico.
      const gap = track.sourceGapId
        ? await db.meridianGap.findFirst({
            where: { id: track.sourceGapId, tenantId: ctx.tenantId },
            select: { code: true, statement: true },
          })
        : null;

      return {
        id: track.id,
        code: track.code,
        processName: track.processName,
        archetype: track.archetype,
        status: track.status,
        currentPhase: track.currentPhase,
        startedAt: track.startedAt,
        templateLabel: track.templateVersion.label,
        templateName: track.templateVersion.template.name,
        ownerId: track.ownerId,
        ownerName: nameOf(track.ownerId),
        consultantName: nameOf(track.consultantId),
        sourceGap: gap,
        businessCase: track.businessCase
          ? {
              id: track.businessCase.id,
              code: track.businessCase.code,
              state: track.businessCase.state,
              signed: Boolean(track.businessCase.signedVersionId),
            }
          : null,
        phases: track.phases.map((p): TrackDetailPhase => {
          const result = p.results[0];
          return {
            id: p.id,
            phase: p.phase,
            state: p.state,
            openedAt: p.openedAt,
            closedAt: p.closedAt,
            observationEndsAt: p.observationEndsAt,
            reopenCount: p.reopenCount,
            reopenCountAtClose: p.reopenCountAtClose,
            charterPolicyAckAt: p.charterPolicyAckAt,
            charterPolicy:
              charterPolicies.find((c) => c.id === p.charterPolicyId) ?? null,
            // Só a SCALE oferece vínculo: a política se aplica ao fluxo quando
            // ele vai para o time inteiro, e ofertá-la nas outras fases seria
            // convidar a marcar cedo o que SG-05 quer marcado no lugar certo.
            charterAvailable: p.phase === "SCALE" ? charterPolicies : [],
            steps: p.steps.map((st) => ({
              id: st.id,
              seq: st.seq,
              statement: st.statement,
              expectedArtefact: st.expectedArtefact,
              required: st.required,
              state: st.state,
              completedAt: st.completedAt,
              artefacts: st.artefacts,
            })),
            criteria: track.templateVersion.criteria
              .filter((c) => c.phase === p.phase)
              .map((c) => ({
                key: c.key,
                statement: c.statement,
                evaluationType: c.evaluationType,
              })),
            result: result
              ? {
                  outcome: result.outcome,
                  decidedAt: result.decidedAt,
                  cycle: result.cycle,
                  criteriaSnapshot: result.criteriaSnapshot,
                  override: result.override
                    ? {
                        actorId: result.override.actorId,
                        unmetCriteria: result.override.unmetCriteria,
                        rationale: result.override.rationale,
                        createdAt: result.override.createdAt,
                      }
                    : null,
                }
              : null,
          };
        }),
      };
    });
  });
}

/**
 * Cancela a trilha. Nunca apaga: `status = CANCELLED`.
 *
 * O guard de caso de negócio assinado entra com US4 — a tabela ainda não
 * existe. O ponto está marcado abaixo em vez de ficar implícito, porque quem
 * implementar US4 precisa vê-lo aqui e não no plano.
 */
export async function cancelTrack(
  raw: z.input<typeof CancelTrackSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("track.manage");
    const input = CancelTrackSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const track = await db.scaffoldTrack.findFirst({
        where: { id: input.trackId, tenantId: ctx.tenantId },
        select: {
          id: true,
          code: true,
          processName: true,
          status: true,
          businessCase: { select: { code: true, signedVersionId: true } },
        },
      });
      if (!track) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }

      // Trilha com promessa assinada não se cancela em silêncio. O artefato
      // continua existindo e o Signal continua apurando contra ele — cancelar
      // sem dizer o que fazer com essa apuração deixaria uma promessa viva sem
      // ninguém para cumpri-la. A decisão é explícita, e vai para a trilha.
      if (track.businessCase?.signedVersionId && !input.signalDecision) {
        throw new ScaffoldRuleError("TRACK_HAS_SIGNED_BUSINESS_CASE");
      }

      await db.scaffoldTrack.update({
        where: { id: track.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.track.cancel",
        entityType: "scaffold.track",
        entityId: track.id,
        target: `${track.code} · ${track.processName}`,
        note: track.businessCase?.signedVersionId
          ? `${input.rationale} · Signal: ${input.signalDecision === "stop_reading" ? "para de apurar" : "segue apurando"} ${track.businessCase.code}.`
          : input.rationale,
        diff: [["Status", track.status, "CANCELLED"]],
      });
    });

    revalidatePath("/scaffold");
  });
}
