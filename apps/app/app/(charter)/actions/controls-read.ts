"use server";

import { type CharterDataClass, withTenantDb } from "@repo/database";
import { hasCharterPermission } from "@repo/rbac";
import { z } from "zod";
import {
  caseDecisionBlockers,
  controlProgress,
  partitionByClass,
} from "@/lib/charter/case-controls";
import {
  CADENCE_LABEL,
  CONTROL_ROLE_LABEL,
  notApplicableLabel,
} from "@/lib/charter/controls-view";
import { requireCharterContext } from "@/lib/charter/guards";
import { DATA_CLASS_LABEL, RISK_CATEGORY_LABEL } from "@/lib/charter/rules";
import { type Result, safeAction } from "../../actions/_base";
import { GovernanceError } from "./_shared";

// Leituras das telas de controle do Charter — CH-DEV-04.
//
// Só leitura. As mutações (anexar, enviar, aceitar…) são do backend em
// `case-controls.ts`. Toda query filtra pelo tenant do contexto; perfil e
// versão de perfil não têm tenant (são o método da Nebuloz).

type Db = Parameters<Parameters<typeof withTenantDb>[1]>[0];

export type ProfileControlView = {
  code: string;
  name: string;
  category: string;
  categoryLabel: string;
  evidence: string;
  acceptanceCriteria: string;
  role: string;
  roleLabel: string;
  cadence: keyof typeof CADENCE_LABEL;
  cadenceLabel: string;
  minClass: CharterDataClass;
  minClassLabel: string;
  dispensable: boolean;
};

export type ProfileCard = {
  workForm: string;
  name: string;
  versionLabel: string;
  dominantRisks: { id: string; label: string }[];
  decisionRoleLabel: string;
  note: string | null;
  /** Jurídico/DPO E Segurança assinaram (CH-PO-01). Sem isso é rascunho. */
  signed: boolean;
  controls: ProfileControlView[];
  casesInUse: { code: string; title: string }[];
};

type RawControl = {
  code: string;
  name: string;
  category: string;
  evidence: string;
  acceptanceCriteria: string | null;
  role: string;
  cadence: string;
  minClass: CharterDataClass;
  dispensable: boolean;
};

const categoryLabel = (c: string) =>
  RISK_CATEGORY_LABEL[c as keyof typeof RISK_CATEGORY_LABEL] ?? c;

const className = (c: CharterDataClass) => DATA_CLASS_LABEL[c];

function toProfileControl(c: RawControl): ProfileControlView {
  return {
    code: c.code,
    name: c.name,
    category: c.category,
    categoryLabel: categoryLabel(c.category),
    evidence: c.evidence,
    acceptanceCriteria: c.acceptanceCriteria ?? "",
    role: c.role,
    roleLabel: CONTROL_ROLE_LABEL[c.role] ?? c.role,
    cadence: c.cadence as keyof typeof CADENCE_LABEL,
    cadenceLabel:
      CADENCE_LABEL[c.cadence as keyof typeof CADENCE_LABEL] ?? c.cadence,
    minClass: c.minClass,
    minClassLabel: className(c.minClass),
    dispensable: c.dispensable,
  };
}

const LATEST_VERSION = {
  versions: {
    orderBy: { publishedAt: "desc" },
    take: 1,
    include: { controls: { orderBy: { seq: "asc" } } },
  },
} as const;

// ── Perfis de controle ────────────────────────────────────────────────────────

export async function listControlProfiles(): Promise<Result<ProfileCard[]>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();

    return withTenantDb(ctx.tenantId, async (db) => {
      const [profiles, cases] = await Promise.all([
        db.charterControlProfile.findMany({ include: LATEST_VERSION }),
        db.charterUseCase.findMany({
          where: { tenantId: ctx.tenantId, workForm: { not: null } },
          select: { code: true, title: true, workForm: true },
          orderBy: { code: "asc" },
        }),
      ]);

      return profiles
        .filter((p) => p.versions.length > 0)
        .map((p) => {
          const v = p.versions[0];
          return {
            workForm: p.workForm,
            name: p.name,
            versionLabel: v.label,
            dominantRisks: v.dominantRisks.map((r) => ({
              id: r,
              label: categoryLabel(r),
            })),
            decisionRoleLabel:
              CONTROL_ROLE_LABEL[v.decisionRole] ?? v.decisionRole,
            note: v.note,
            signed: v.legalSignedAt !== null && v.securitySignedAt !== null,
            controls: v.controls.map(toProfileControl),
            casesInUse: cases
              .filter((c) => c.workForm === p.workForm)
              .map((c) => ({ code: c.code, title: c.title })),
          };
        });
    });
  });
}

// ── Controles do caso (aba + modal) ───────────────────────────────────────────

export type ControlEventView = {
  id: string;
  action: string;
  actor: string;
  fromState: string | null;
  toState: string | null;
  comment: string | null;
  at: Date;
};

export type CaseControlView = ProfileControlView & {
  state: string;
  isExtra: boolean;
  ownerId: string | null;
  ownerName: string | null;
  summary: string | null;
  fileName: string | null;
  evidenceProducedAt: Date | null;
  acceptedAt: Date | null;
  expiresAt: Date | null;
  dispensedUntil: Date | null;
  dispensedReason: string | null;
  mitigation: { code: string; action: string } | null;
  blocksDecision: boolean;
  events: ControlEventView[];
};

export type CaseControlsView = {
  caseCode: string;
  caseTitle: string;
  dataClass: CharterDataClass;
  dataClassLabel: string;
  profile: { name: string; versionLabel: string } | null;
  controls: CaseControlView[];
  progress: ReturnType<typeof controlProgress>;
  blockers: ReturnType<typeof caseDecisionBlockers>;
  notApplicable: { codes: string[]; label: string | null };
  can: { submit: boolean; decide: boolean };
  /** Controles de OUTROS perfis que o caso ainda não tem, para adicionar. */
  addable: { profileName: string; controls: ProfileControlView[] }[];
  /** "Mesmo processo": códigos do processo nos outros produtos (ProcessRegistry). */
  process: {
    scaffold: string | null;
    signal: string | null;
    meridian: string | null;
  };
};

async function people(
  db: Db,
  ids: (string | null)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (unique.length === 0) {
    return new Map();
  }
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.name ?? u.email ?? "—"]));
}

/** Códigos do mesmo processo nos outros produtos. O Charter só LÊ o registro:
 *  cada produto é dono da sua entidade (mapa de fronteiras). */
async function processOf(db: Db, tenantId: string, useCaseId: string) {
  const none = { scaffold: null, signal: null, meridian: null };
  const reg = await db.processRegistry.findFirst({
    where: { tenantId, charterUseCaseId: useCaseId },
  });
  if (!reg) {
    return none;
  }
  const [track, initiative, gap] = await Promise.all([
    reg.scaffoldTrackId
      ? db.scaffoldTrack.findFirst({
          where: { id: reg.scaffoldTrackId, tenantId },
          select: { code: true },
        })
      : null,
    reg.signalInitiativeId
      ? db.signalInitiative.findFirst({
          where: { id: reg.signalInitiativeId, tenantId },
          select: { code: true },
        })
      : null,
    reg.meridianGapId
      ? db.meridianGap.findFirst({
          where: { id: reg.meridianGapId, tenantId },
          select: { code: true },
        })
      : null,
  ]);
  return {
    scaffold: track?.code ?? null,
    signal: initiative?.code ?? null,
    meridian: gap?.code ?? null,
  };
}

async function addableFromOthers(
  db: Db,
  ownWorkForm: string | null,
  have: Set<string>
) {
  const profiles = await db.charterControlProfile.findMany({
    include: LATEST_VERSION,
  });
  return profiles
    .filter((p) => p.workForm !== ownWorkForm && p.versions.length > 0)
    .map((p) => ({
      profileName: p.name,
      controls: p.versions[0].controls
        .filter((c) => !have.has(c.code))
        .map(toProfileControl),
    }))
    .filter((p) => p.controls.length > 0);
}

export async function getCaseControls(input: {
  code: string;
}): Promise<Result<CaseControlsView>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    const { code } = z.object({ code: z.string().trim().min(1) }).parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const uc = await db.charterUseCase.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code } },
      });
      if (!uc) {
        throw new GovernanceError("case.unknown", "Caso não encontrado.");
      }

      const [rows, version] = await Promise.all([
        db.charterCaseControl.findMany({
          where: { tenantId: ctx.tenantId, useCaseId: uc.id },
          include: {
            mitigation: { select: { code: true, action: true } },
            events: { orderBy: { createdAt: "desc" } },
          },
          orderBy: [{ isExtra: "asc" }, { code: "asc" }],
        }),
        uc.controlProfileVersionId
          ? db.charterControlProfileVersion.findUnique({
              where: { id: uc.controlProfileVersionId },
              include: {
                controls: { orderBy: { seq: "asc" } },
                profile: { select: { name: true, workForm: true } },
              },
            })
          : null,
      ]);

      const names = await people(db, [
        ...rows.map((r) => r.ownerId),
        ...rows.flatMap((r) => r.events.map((e) => e.actorId)),
      ]);
      const blockers = caseDecisionBlockers(rows);
      const blocking = new Set(blockers.map((b) => b.code));
      const { notApplicable } = version
        ? partitionByClass(version.controls, uc.dataClass)
        : { notApplicable: [] };

      return {
        caseCode: uc.code,
        caseTitle: uc.title,
        dataClass: uc.dataClass,
        dataClassLabel: className(uc.dataClass),
        profile: version
          ? { name: version.profile.name, versionLabel: version.label }
          : null,
        controls: rows.map((r) => ({
          ...toProfileControl(r),
          state: r.state,
          isExtra: r.isExtra,
          ownerId: r.ownerId,
          ownerName: r.ownerId ? (names.get(r.ownerId) ?? null) : r.ownerName,
          summary: r.summary,
          fileName: r.fileName,
          evidenceProducedAt: r.evidenceProducedAt,
          acceptedAt: r.acceptedAt,
          expiresAt: r.expiresAt,
          dispensedUntil: r.dispensedUntil,
          dispensedReason: r.dispensedReason,
          mitigation: r.mitigation,
          blocksDecision: blocking.has(r.code),
          events: r.events.map((e) => ({
            id: e.id,
            action: e.action,
            actor: e.actorId ? (names.get(e.actorId) ?? "—") : "Sistema",
            fromState: e.fromState,
            toState: e.toState,
            comment: e.comment,
            at: e.createdAt,
          })),
        })),
        progress: controlProgress(rows),
        blockers,
        notApplicable: {
          codes: notApplicable.map((c) => c.code),
          label: notApplicableLabel(notApplicable.length, uc.dataClass),
        },
        can: {
          submit: hasCharterPermission(ctx.charterRole, "case.submit"),
          decide: hasCharterPermission(ctx.charterRole, "case.decide"),
        },
        addable: await addableFromOthers(
          db,
          version?.profile.workForm ?? uc.workForm,
          new Set(rows.map((r) => r.code))
        ),
        process: await processOf(db, ctx.tenantId, uc.id),
      };
    });
  });
}
