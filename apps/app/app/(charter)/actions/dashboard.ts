"use server";

import {
  type CharterDataClass,
  type CharterSectionStatus,
  type CharterUseCaseStatus,
  withTenantDb,
} from "@repo/database";
import { requireCharterContext } from "@/lib/charter/guards";
import {
  caseRisk,
  policyPublishBlockers,
  SEM_PONTUACAO,
  slaRemaining,
} from "@/lib/charter/rules";
import { feriadosAbertos } from "@/lib/feriados";
import { type Result, safeAction } from "../../actions/_base";

// Visão Geral de Governança — FR-1.
//
// Responde "onde a política está, o que espera decisão e o que já é evidência".
// A fila de revisão é ordenada por **folga de SLA**, não por data: o que vence
// primeiro aparece primeiro, que é a pergunta que o Compliance Lead faz de manhã.

export type Alert = {
  tone: "red" | "amber" | "accent";
  icon: string;
  title: string;
  sub: string;
  action: string;
  screen: string;
  param?: string;
};

export type QueueRow = {
  code: string;
  title: string;
  status: CharterUseCaseStatus;
  dataClass: CharterDataClass;
  /** Null = ninguém pontuou; `riskLabel` diz "sem pontuação". */
  score: number | null;
  riskLabel: string;
  riskTone: string;
  reviewerName: string | null;
  sla: number | null;
  slaTotal: number | null;
};

export type DashboardData = {
  org: { name: string; posture: string; geo: string | null };
  kpis: {
    pending: number;
    slaAtRisk: number;
    highRisk: number;
    ackPct: number;
    ackDone: number;
    ackAll: number;
    vendorsInReview: number;
    vendorsTotal: number;
  };
  queue: QueueRow[];
  policy: {
    name: string;
    version: string | null;
    publishedAt: string | null;
    nextReview: string | null;
    daysToReview: number | null;
    approver: string | null;
    sections: {
      ordinal: number;
      name: string;
      status: CharterSectionStatus;
    }[];
    publishedCount: number;
    blockerCount: number;
  } | null;
  /** Casos ativos com severidade ≥ 4 na categoria — exposição, não média. */
  categoryExposure: { id: string; count: number }[];
  activeCount: number;
  alerts: Alert[];
};

const OPEN_STATUSES: CharterUseCaseStatus[] = [
  "SUBMITTED",
  "REVIEW",
  "CHANGES",
];

const CATEGORY_FIELD = {
  PRIVACY: "riskPrivacy",
  REGULATORY: "riskRegulatory",
  SECURITY: "riskSecurity",
  BIAS: "riskBias",
  IP: "riskIp",
  OPERATIONAL: "riskOperational",
  REPUTATIONAL: "riskReputational",
} as const;

export async function getDashboard(): Promise<Result<DashboardData>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();

    return withTenantDb(ctx.tenantId, async (db) => {
      const [tenant, settings, cases, mitigations, acks, policy, vendors] =
        await Promise.all([
          db.tenant.findUniqueOrThrow({
            where: { id: ctx.tenantId },
            select: { name: true },
          }),
          db.charterSettings.findUnique({ where: { tenantId: ctx.tenantId } }),
          db.charterUseCase.findMany({
            where: { tenantId: ctx.tenantId },
            include: { vendor: { select: { name: true } } },
          }),
          db.charterMitigation.findMany({
            where: { tenantId: ctx.tenantId, status: { not: "DONE" } },
            include: { useCase: { select: { code: true } } },
          }),
          db.charterAcknowledgment.findMany({
            where: { tenantId: ctx.tenantId },
            select: { status: true },
          }),
          db.charterPolicy.findFirst({
            where: { tenantId: ctx.tenantId },
            orderBy: { createdAt: "asc" },
            include: { sections: { orderBy: { ordinal: "asc" } } },
          }),
          db.charterVendor.findMany({
            where: { tenantId: ctx.tenantId },
            include: { _count: { select: { useCases: true } } },
          }),
        ]);

      const reviewers = await db.user.findMany({
        where: {
          id: {
            in: cases.map((c) => c.reviewerId).filter((x): x is string => !!x),
          },
        },
        select: { id: true, name: true, email: true },
      });
      const reviewerName = new Map(
        reviewers.map((r) => [r.id, r.name ?? r.email])
      );

      const now = Date.now();
      // Arquivado e rascunho não são "ativos": um não anda mais, o outro nunca
      // foi declarado. Contá-los infla toda métrica de exposição.
      const active = cases.filter(
        (c) => !["ARCHIVED", "DRAFT"].includes(c.status)
      );
      const pending = cases.filter((c) => OPEN_STATUSES.includes(c.status));

      const scored = (c: (typeof cases)[number]) =>
        caseRisk(
          {
            privacy: c.riskPrivacy,
            regulatory: c.riskRegulatory,
            security: c.riskSecurity,
            bias: c.riskBias,
            ip: c.riskIp,
            operational: c.riskOperational,
            reputational: c.riskReputational,
          },
          c.riskScoredAt
        );

      const highRisk = active.filter((c) => (scored(c)?.score ?? 0) >= 16);

      // Uma busca por render, cacheada por 30 dias e compartilhada por toda
      // a fila: o SLA de cada linha usa o mesmo calendário.
      const feriados = await feriadosAbertos();

      const queue: QueueRow[] = pending
        .map((c) => {
          const r = scored(c);
          return {
            code: c.code,
            title: c.title,
            status: c.status,
            dataClass: c.dataClass,
            score: r?.score ?? null,
            riskLabel: r?.label ?? SEM_PONTUACAO,
            riskTone: r?.tone ?? "accent",
            reviewerName: c.reviewerId
              ? (reviewerName.get(c.reviewerId) ?? null)
              : null,
            sla: slaRemaining(c.submittedAt, c.slaTotal, new Date(), feriados),
            slaTotal: c.slaTotal,
          };
        })
        // Menor folga primeiro. `null` (sem SLA) vai para o fim.
        .sort((a, b) => (a.sla ?? 99) - (b.sla ?? 99));

      const slaAtRisk = queue.filter(
        (q) => q.sla !== null && q.sla <= 2
      ).length;

      const ackDone = acks.filter((a) => a.status === "ACKNOWLEDGED").length;
      const ackAll = acks.length;

      const blockers = policy
        ? policyPublishBlockers(
            policy.sections.map((s) => ({
              id: s.id,
              name: s.name,
              status: s.status,
            }))
          )
        : [];

      const approver = policy?.approverId
        ? ((
            await db.user.findUnique({
              where: { id: policy.approverId },
              select: { name: true, email: true },
            })
          )?.name ?? null)
        : null;

      const categoryExposure = (
        Object.keys(CATEGORY_FIELD) as (keyof typeof CATEGORY_FIELD)[]
      ).map((id) => ({
        id,
        count: active.filter((c) => c[CATEGORY_FIELD[id]] >= 4).length,
      }));

      // ── Fila de alertas, priorizada por severidade ──
      const alerts: Alert[] = [];

      for (const q of queue
        .filter((x) => x.sla !== null && x.sla < 0)
        .slice(0, 2)) {
        alerts.push({
          tone: "red",
          icon: "alert",
          title: `${q.code} fora de SLA`,
          sub: `${q.title} · vencido há ${Math.abs(q.sla ?? 0)} dias úteis`,
          action: "Abrir caso",
          screen: "case",
          param: q.code,
        });
      }
      for (const q of queue
        .filter(
          (x) => !x.reviewerName && x.sla !== null && x.sla >= 0 && x.sla <= 2
        )
        .slice(0, 2)) {
        alerts.push({
          tone: "red",
          icon: "alert",
          title: `${q.code} sem revisor atribuído`,
          sub: `${q.title} · SLA vence em ${q.sla} dias úteis`,
          action: "Atribuir revisor",
          screen: "case",
          param: q.code,
        });
      }
      for (const v of vendors.filter((x) => !x.dpa).slice(0, 2)) {
        alerts.push({
          tone: "amber",
          icon: "plug",
          title: `${v.name} opera sem DPA assinado`,
          sub: `${v.code} · ${v._count.useCases} casos de uso vinculados`,
          action: "Abrir fornecedor",
          screen: "vendor",
          param: v.code,
        });
      }
      const overdueMit = mitigations.filter(
        (m) => m.dueDate !== null && m.dueDate.getTime() < now
      );
      if (overdueMit[0]) {
        const m = overdueMit[0];
        alerts.push({
          tone: "amber",
          icon: "clock",
          title: `${m.code} atrasada`,
          sub: `${m.action.slice(0, 70)} · ${m.ownerName ?? "sem dono"}`,
          action: "Ver mitigação",
          screen: "risk",
        });
      }
      if (blockers.length > 0) {
        alerts.push({
          tone: "accent",
          icon: "fileText",
          title: `${blockers.length} seções de política fora de publicação`,
          sub: blockers
            .slice(0, 3)
            .map((b) => b.name)
            .join(", "),
          action: "Abrir política",
          screen: "policy",
        });
      }
      if (ackAll - ackDone > 0) {
        alerts.push({
          tone: "accent",
          icon: "users",
          title: `${ackAll - ackDone} pessoas sem aceite`,
          sub: `Cobertura de onboarding em ${ackAll ? Math.round((ackDone / ackAll) * 100) : 0}%`,
          action: "Ver onboarding",
          screen: "onboarding",
        });
      }

      const POSTURE_LABEL: Record<string, string> = {
        CONSERVATIVE: "Conservadora",
        MODERATE: "Moderada",
        AGGRESSIVE: "Agressiva",
      };

      return {
        org: {
          name: tenant.name,
          posture: POSTURE_LABEL[settings?.posture ?? "MODERATE"],
          geo: settings?.geo ?? null,
        },
        kpis: {
          pending: pending.length,
          slaAtRisk,
          highRisk: highRisk.length,
          ackPct: ackAll ? Math.round((ackDone / ackAll) * 100) : 0,
          ackDone,
          ackAll,
          vendorsInReview: vendors.filter((v) => v.tier === "REVIEW").length,
          vendorsTotal: vendors.length,
        },
        queue,
        policy: policy
          ? {
              name: policy.name,
              version: policy.version,
              publishedAt: policy.publishedAt?.toISOString() ?? null,
              nextReview: policy.nextReview?.toISOString() ?? null,
              daysToReview: policy.nextReview
                ? Math.ceil((policy.nextReview.getTime() - now) / 86_400_000)
                : null,
              approver,
              sections: policy.sections.map((s) => ({
                ordinal: s.ordinal,
                name: s.name,
                status: s.status,
              })),
              publishedCount: policy.sections.filter(
                (s) => s.status === "PUBLISHED"
              ).length,
              blockerCount: blockers.length,
            }
          : null,
        categoryExposure,
        activeCount: active.length,
        alerts,
      };
    });
  });
}
