"use server";

import {
  type CharterCaseControlAction,
  type CharterCaseControlState,
  type CharterDataClass,
  type CharterRiskCategory,
  withTenantDb,
} from "@repo/database";
import { CHARTER_EVIDENCE_BUCKET, storageClient } from "@repo/storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  type ControlAction,
  type ControlCadence,
  ControlTransitionError,
  caseDecisionBlockers,
  controlProgress,
  EDITABLE_STATES,
  expiresAtFor,
  MAX_DISPENSE_DAYS,
  nextControlState,
  partitionByClass,
} from "@/lib/charter/case-controls";
import {
  evidenceFileNameOfKey,
  isEvidenceKeyOf,
} from "@/lib/charter/evidence-file";
import {
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import { emitProductEvent } from "@/lib/inngest/emit-product-event";
import { type Result, safeAction } from "../../actions/_base";
import { type Db, GovernanceError, logCharterAudit } from "./_shared";

// Plano de controles do caso — CH-DEV-02, CH-DEV-03, CH-DEV-05 e CH-DEV-06.
//
// Permissões no backend (a tela desabilita botão, mas quem protege é aqui):
//   • `case.submit` — gerar o plano, anexar, enviar, editar, adicionar controle;
//   • `case.decide` — aceitar, pedir ajuste, dispensar, reabrir.
// Pedir ajuste, dispensar e reabrir exigem comentário. Toda ação grava um
// CharterCaseControlEvent (append-only no banco) e a entrada de auditoria do
// Charter, na MESMA transação da escrita: ato sem trilha é pior que ato que não
// aconteceu. Eventos entre produtos (X-04) saem só depois da transação.

const MAX_COMMENT = 2000;
const MAX_EXTRA_ATTEMPTS = 5;

const Ref = z.object({
  code: z.string().trim().min(1),
  controlCode: z.string().trim().min(1),
});
const Comment = z
  .string()
  .trim()
  .min(1, "Comentário é obrigatório")
  .max(MAX_COMMENT);

/** Conflito de estado (409): o controle não está onde a ação supõe. */
class ControlStateConflict extends GovernanceError {
  override readonly status = 422;
}

// ── Carregamento ──────────────────────────────────────────────────────────────

async function loadUseCase(db: Db, tenantId: string, code: string) {
  const uc = await db.charterUseCase.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      dataClass: true,
      ownerId: true,
      workForm: true,
      controlProfileVersionId: true,
    },
  });
  if (!uc) {
    throw new GovernanceError("case.unknown", "Caso não encontrado.");
  }
  if (uc.status === "ARCHIVED") {
    throw new GovernanceError(
      "case.archived",
      "Caso arquivado não aceita mudança no plano de controles."
    );
  }
  return uc;
}

async function loadControl(
  db: Db,
  tenantId: string,
  useCaseId: string,
  controlCode: string
) {
  const control = await db.charterCaseControl.findUnique({
    where: {
      tenantId_useCaseId_code: { tenantId, useCaseId, code: controlCode },
    },
  });
  if (!control) {
    throw new GovernanceError(
      "control.unknown",
      `Controle ${controlCode} não existe neste caso.`
    );
  }
  return control;
}

type Loaded = Awaited<ReturnType<typeof loadControl>>;
type Ctx = Awaited<ReturnType<typeof requireCharterPermissionContext>>;

function toStateOrThrow(
  from: CharterCaseControlState,
  action: ControlAction
): CharterCaseControlState {
  try {
    return nextControlState(from, action) as CharterCaseControlState;
  } catch (error) {
    if (error instanceof ControlTransitionError) {
      throw new ControlStateConflict("control.transition", error.message);
    }
    throw error;
  }
}

/**
 * A escrita de toda transição de estado. Ponto único.
 *
 * O UPDATE leva `state: from` no where: se outra pessoa mexeu no controle entre
 * o carregamento e a escrita, `count` volta 0 e a ação falha em vez de pisar na
 * decisão dela (dois revisores aceitando e pedindo ajuste ao mesmo tempo).
 */
async function applyTransition(args: {
  db: Db;
  ctx: Ctx;
  uc: { id: string; code: string; title: string };
  control: Loaded;
  action: ControlAction;
  auditAction: CharterCaseControlAction;
  patch?: Record<string, unknown>;
  comment?: string;
  label: string;
}): Promise<CharterCaseControlState> {
  const { db, ctx, uc, control, action, auditAction, patch, comment, label } =
    args;
  const to = toStateOrThrow(control.state, action);

  const updated = await db.charterCaseControl.updateMany({
    where: { id: control.id, tenantId: ctx.tenantId, state: control.state },
    data: { state: to, ...(patch ?? {}) },
  });
  if (updated.count === 0) {
    throw new ControlStateConflict(
      "control.changed",
      `O controle ${control.code} mudou de estado enquanto você trabalhava. Recarregue e tente de novo.`
    );
  }

  await db.charterCaseControlEvent.create({
    data: {
      tenantId: ctx.tenantId,
      caseControlId: control.id,
      action: auditAction,
      actorId: ctx.userId,
      fromState: control.state,
      toState: to,
      comment: comment ?? null,
    },
  });

  await logCharterAudit(db, ctx, {
    action: label,
    entityType: "charter.casecontrol",
    entityId: control.id,
    target: `${uc.code} · ${control.code} ${control.name}`,
    note: comment,
    diff: [["Estado", control.state, to]],
  });
  return to;
}

/**
 * A chave do arquivo é EXATAMENTE uma que o servidor emite para ESTE caso e ESTE
 * controle do tenant (`<tenant>/charter/<caso>/<controle>/v<N>-<uuid>/<nome>`).
 * Tenant certo não basta: sem a checagem do caso e do controle, dava para anexar
 * a um controle o arquivo enviado para outro.
 */
function assertEvidenceKey(
  tenantId: string,
  ref: { code: string; controlCode: string },
  fileKey: string
): void {
  if (
    !isEvidenceKeyOf(fileKey, {
      tenantId,
      caseCode: ref.code,
      controlCode: ref.controlCode,
    })
  ) {
    throw new GovernanceError(
      "control.file.key",
      "Arquivo que não pertence a este controle. Envie o arquivo de novo por esta tela."
    );
  }
}

/** O objeto existe no storage? Anexar a chave de um PUT que não aconteceu deixaria
 *  o "Enviar para revisão" apontando para o vazio. Fora da transação: é rede. */
async function assertFileInStorage(fileKey: string): Promise<void> {
  const { data: present, error } = await storageClient.storage
    .from(CHARTER_EVIDENCE_BUCKET)
    .exists(fileKey);
  if (error || !present) {
    throw new GovernanceError(
      "control.file.missing",
      "O arquivo não chegou ao armazenamento. Envie de novo."
    );
  }
}

/**
 * Separação de deveres. Quem produziu a evidência não a aceita, dispensa, nem
 * pede ajuste ou reabre: senão uma pessoa só fecha o controle sozinha.
 *
 * "Produziu" = responsável (ownerId) do controle ou autor do último ATTACH/SUBMIT
 * dele. Para aceitar e dispensar, o dono do CASO também fica de fora (interesse
 * direto no resultado: CH-PO-04 veda dispensa pelo próprio solicitante).
 */
async function assertNotProducer(args: {
  db: Db;
  ctx: Ctx;
  uc: { ownerId: string | null };
  control: Loaded;
  includeCaseOwner: boolean;
}): Promise<void> {
  const { db, ctx, uc, control, includeCaseOwner } = args;
  const last = await db.charterCaseControlEvent.findMany({
    where: {
      caseControlId: control.id,
      action: { in: ["ATTACH", "SUBMIT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { actorId: true },
  });
  const forbidden = new Set<string>();
  if (control.ownerId) {
    forbidden.add(control.ownerId);
  }
  if (includeCaseOwner && uc.ownerId) {
    forbidden.add(uc.ownerId);
  }
  for (const event of last) {
    if (event.actorId) {
      forbidden.add(event.actorId);
    }
  }
  if (forbidden.has(ctx.userId)) {
    throw new GovernanceError(
      "control.separation",
      `Quem produziu ou responde por ${control.code} não pode decidir sobre a própria evidência. Peça a outra pessoa com permissão de decidir.`
    );
  }
}

// ── Gerar o plano do caso (CH-DEV-02) ─────────────────────────────────────────

const GenerateSchema = z.object({
  code: z.string().trim().min(1),
  workForm: z.enum([
    "CONVERSATIONAL",
    "ANALYSIS",
    "DOC_REVIEW",
    "TRIAGE",
    "REPORTING",
  ]),
});

export type ControlPlanSummary = {
  dataClass: CharterDataClass;
  applicable: number;
  notApplicable: number;
  notApplicableCodes: string[];
  created: number;
};

/**
 * Gera o plano de controles do caso a partir do perfil da forma de trabalho,
 * filtrado pela classe de dado do caso. Os que não se aplicam são contados e
 * devolvidos ("N controles não se aplicam à classe X").
 *
 * Só usa perfil com as DUAS assinaturas (Jurídico/DPO e Segurança, CH-PO-01):
 * perfil em rascunho existe para o dev, não para caso real.
 *
 * Idempotente: repetir com a mesma forma não recria nada. Trocar a forma de um
 * caso que já tem plano é recusado; o plano existente tem evidência.
 */
export async function generateCaseControlPlan(
  input: z.input<typeof GenerateSchema>
): Promise<Result<ControlPlanSummary>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.submit");
    const data = GenerateSchema.parse(input);

    const summary = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);

      if (uc.workForm && uc.workForm !== data.workForm) {
        throw new GovernanceError(
          "plan.exists",
          `O caso ${uc.code} já tem plano de controles da forma ${uc.workForm}. Mudar a forma exigiria descartar evidência já produzida.`
        );
      }

      const version = uc.controlProfileVersionId
        ? await db.charterControlProfileVersion.findUnique({
            where: { id: uc.controlProfileVersionId },
            include: { controls: { orderBy: { seq: "asc" } } },
          })
        : await db.charterControlProfileVersion.findFirst({
            where: {
              profile: { workForm: data.workForm },
              legalSignedBy: { not: null },
              securitySignedBy: { not: null },
            },
            orderBy: { publishedAt: "desc" },
            include: { controls: { orderBy: { seq: "asc" } } },
          });
      if (!version) {
        throw new GovernanceError(
          "profile.unsigned",
          "Não há perfil de controle desta forma de trabalho assinado por Jurídico/DPO e por Segurança."
        );
      }

      const { applicable, notApplicable } = partitionByClass(
        version.controls,
        uc.dataClass
      );
      const base = {
        dataClass: uc.dataClass,
        applicable: applicable.length,
        notApplicable: notApplicable.length,
        notApplicableCodes: notApplicable.map((c) => c.code),
      };
      if (uc.controlProfileVersionId) {
        return { ...base, created: 0 };
      }

      await db.charterUseCase.update({
        where: { id: uc.id },
        data: { workForm: data.workForm, controlProfileVersionId: version.id },
      });

      // Mitigação existente do caso liga ao controle da mesma categoria (CH-PM-02),
      // uma por controle, sem repetir.
      const mitigations = await db.charterMitigation.findMany({
        where: { tenantId: ctx.tenantId, useCaseId: uc.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, category: true },
      });
      const free = new Map<CharterRiskCategory, string[]>();
      for (const m of mitigations) {
        free.set(m.category, [...(free.get(m.category) ?? []), m.id]);
      }

      const inserted = await db.charterCaseControl.createMany({
        data: applicable.map((control) => ({
          tenantId: ctx.tenantId,
          useCaseId: uc.id,
          code: control.code,
          profileControlCode: control.code,
          name: control.name,
          category: control.category,
          evidence: control.evidence,
          acceptanceCriteria: control.acceptanceCriteria,
          role: control.role,
          cadence: control.cadence,
          minClass: control.minClass,
          dispensable: control.dispensable,
          mitigationId: free.get(control.category)?.shift() ?? null,
        })),
        skipDuplicates: true,
      });

      // Quem perdeu a corrida (count 0) não repete o START nem a auditoria: o
      // outro processo já os gravou. Quem ganhou registra START só dos controles
      // que ainda não têm evento nenhum.
      if (inserted.count > 0) {
        const fresh = await db.charterCaseControl.findMany({
          where: {
            tenantId: ctx.tenantId,
            useCaseId: uc.id,
            events: { none: {} },
          },
          select: { id: true },
        });
        if (fresh.length > 0) {
          await db.charterCaseControlEvent.createMany({
            data: fresh.map((row) => ({
              tenantId: ctx.tenantId,
              caseControlId: row.id,
              action: "START" as const,
              actorId: ctx.userId,
              fromState: null,
              toState: "NO_EVIDENCE" as const,
              comment: null,
            })),
          });
        }
        await logCharterAudit(db, ctx, {
          action: "Plano de controles gerado",
          entityType: "charter.usecase",
          entityId: uc.id,
          target: `${uc.code} · ${uc.title}`,
          note: `${applicable.length} controle(s) aplicável(is), ${notApplicable.length} fora da classe ${uc.dataClass}.`,
        });
      }
      return { ...base, created: inserted.count };
    });

    revalidatePath("/charter", "layout");
    return summary;
  });
}

// ── Ler o plano ───────────────────────────────────────────────────────────────

export type CaseControlRow = {
  code: string;
  name: string;
  category: CharterRiskCategory;
  state: CharterCaseControlState;
  isExtra: boolean;
  dispensable: boolean;
  summary: string | null;
  fileName: string | null;
  expiresAt: Date | null;
  dispensedUntil: Date | null;
  blocksDecision: boolean;
};

export async function getCaseControlPlan(input: { code: string }): Promise<
  Result<{
    controls: CaseControlRow[];
    progress: ReturnType<typeof controlProgress>;
    blockers: ReturnType<typeof caseDecisionBlockers>;
  }>
> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    const { code } = z.object({ code: z.string().trim().min(1) }).parse(input);

    return withTenantDb(ctx.tenantId, async (db) => {
      const uc = await db.charterUseCase.findUnique({
        where: { tenantId_code: { tenantId: ctx.tenantId, code } },
        select: { id: true },
      });
      if (!uc) {
        throw new GovernanceError("case.unknown", "Caso não encontrado.");
      }
      const rows = await db.charterCaseControl.findMany({
        where: { tenantId: ctx.tenantId, useCaseId: uc.id },
        orderBy: [{ isExtra: "asc" }, { code: "asc" }],
      });
      const blockers = caseDecisionBlockers(rows);
      const blocking = new Set(blockers.map((b) => b.code));
      return {
        controls: rows.map((r) => ({
          code: r.code,
          name: r.name,
          category: r.category,
          state: r.state,
          isExtra: r.isExtra,
          dispensable: r.dispensable,
          summary: r.summary,
          fileName: r.fileName,
          expiresAt: r.expiresAt,
          dispensedUntil: r.dispensedUntil,
          blocksDecision: blocking.has(r.code),
        })),
        progress: controlProgress(rows),
        blockers,
      };
    });
  });
}

// ── Quem submete: anexar, enviar, editar, adicionar ───────────────────────────

const AttachSchema = Ref.extend({
  fileKey: z.string().trim().min(1).max(500),
  // Ignorado: o nome gravado sai do último segmento da chave, não de um campo que
  // o cliente manda ao lado dela. Aceito só para não quebrar quem ainda o envia.
  fileName: z.string().trim().max(255).optional(),
  summary: z.string().trim().max(MAX_COMMENT).optional(),
  evidenceProducedAt: z.coerce.date().optional(),
});

/** Anexa a evidência (arquivo, resumo, data de produção). Vai a "Em elaboração". */
export async function attachControlEvidence(
  input: z.input<typeof AttachSchema>
): Promise<Result<{ state: CharterCaseControlState }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.submit");
    const data = AttachSchema.parse(input);
    assertEvidenceKey(ctx.tenantId, data, data.fileKey);
    await assertFileInStorage(data.fileKey);

    const state = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      const control = await loadControl(
        db,
        ctx.tenantId,
        uc.id,
        data.controlCode
      );
      return applyTransition({
        db,
        ctx,
        uc,
        control,
        action: "ATTACH",
        auditAction: "ATTACH",
        patch: {
          fileKey: data.fileKey,
          fileName: evidenceFileNameOfKey(data.fileKey),
          summary: data.summary ?? control.summary,
          evidenceProducedAt: data.evidenceProducedAt ?? new Date(),
          // Evidência nova invalida a aceitação anterior.
          acceptedAt: null,
          expiresAt: null,
        },
        label: "Evidência de controle anexada",
      });
    });
    revalidatePath("/charter", "layout");
    return { state };
  });
}

/** Envia para revisão. Exige arquivo (CH-DEV-05). */
export async function submitControl(
  input: z.input<typeof Ref>
): Promise<Result<{ state: CharterCaseControlState }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.submit");
    const data = Ref.parse(input);

    const state = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      const control = await loadControl(
        db,
        ctx.tenantId,
        uc.id,
        data.controlCode
      );
      if (!control.fileKey) {
        throw new GovernanceError(
          "control.file.required",
          `Anexe o arquivo da evidência antes de enviar ${control.code} para revisão.`
        );
      }
      return applyTransition({
        db,
        ctx,
        uc,
        control,
        action: "SUBMIT",
        auditAction: "SUBMIT",
        label: "Controle enviado para revisão",
      });
    });
    revalidatePath("/charter", "layout");
    return { state };
  });
}

const EditSchema = Ref.extend({
  summary: z.string().trim().max(MAX_COMMENT).optional(),
  ownerId: z.string().trim().min(1).nullable().optional(),
  ownerName: z.string().trim().max(255).nullable().optional(),
}).refine(
  (v) =>
    v.summary !== undefined ||
    v.ownerId !== undefined ||
    v.ownerName !== undefined,
  { message: "Nada para editar." }
);

/** Edita resumo e responsável, sem mudar de estado. Aceito e dispensado pedem
 *  reabrir antes: editar evidência aceita desfaria o ato de quem aceitou. */
export async function editControl(
  input: z.input<typeof EditSchema>
): Promise<Result<{ state: CharterCaseControlState }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.submit");
    const data = EditSchema.parse(input);

    const state = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      const control = await loadControl(
        db,
        ctx.tenantId,
        uc.id,
        data.controlCode
      );
      if (data.ownerId) {
        // Responsável de outro tenant seria um vínculo com pessoa que não pode
        // nem abrir o caso.
        const member = await db.tenantMember.findFirst({
          where: { tenantId: ctx.tenantId, userId: data.ownerId },
          select: { id: true },
        });
        if (!member) {
          throw new GovernanceError(
            "control.owner.notMember",
            "O responsável precisa ser membro desta organização."
          );
        }
      }
      if (!EDITABLE_STATES.includes(control.state)) {
        throw new ControlStateConflict(
          "control.notEditable",
          `O controle ${control.code} está em ${control.state} e não pode ser editado. Reabra antes.`
        );
      }

      const patch = {
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.ownerName !== undefined ? { ownerName: data.ownerName } : {}),
      };
      const updated = await db.charterCaseControl.updateMany({
        where: { id: control.id, tenantId: ctx.tenantId, state: control.state },
        data: patch,
      });
      if (updated.count === 0) {
        throw new ControlStateConflict(
          "control.changed",
          `O controle ${control.code} mudou de estado enquanto você trabalhava. Recarregue e tente de novo.`
        );
      }
      await db.charterCaseControlEvent.create({
        data: {
          tenantId: ctx.tenantId,
          caseControlId: control.id,
          action: "EDIT",
          actorId: ctx.userId,
          fromState: control.state,
          toState: control.state,
          comment: null,
        },
      });
      await logCharterAudit(db, ctx, {
        action: "Controle editado",
        entityType: "charter.casecontrol",
        entityId: control.id,
        target: `${uc.code} · ${control.code} ${control.name}`,
      });
      return control.state;
    });
    revalidatePath("/charter", "layout");
    return { state };
  });
}

const ExtraSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1).max(255),
  category: z.enum([
    "PRIVACY",
    "REGULATORY",
    "SECURITY",
    "BIAS",
    "IP",
    "OPERATIONAL",
    "REPUTATIONAL",
  ]),
  evidence: z.string().trim().min(1).max(MAX_COMMENT),
  acceptanceCriteria: z.string().trim().max(MAX_COMMENT).optional(),
  role: z.enum(["COMPLIANCE", "LEGAL", "SECURITY"]),
  cadence: z.enum([
    "WEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "SEMIANNUAL",
    "ANNUAL",
    "PER_CYCLE",
  ]),
});

/** Adiciona controle fora do perfil (CH-DEV-03: `extra`). Entra SEM evidência e,
 *  por isso, já bloqueia a decisão do caso. */
export async function addExtraControl(
  input: z.input<typeof ExtraSchema>
): Promise<Result<{ controlCode: string }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.submit");
    const data = ExtraSchema.parse(input);

    const controlCode = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      // Próximo número = maior X-n existente + 1 (não a contagem: controle
      // extra removido deixaria buraco e a contagem repetiria número). Em
      // corrida, ON CONFLICT DO NOTHING devolve count 0 e tenta o seguinte.
      const rows = await db.charterCaseControl.findMany({
        where: { useCaseId: uc.id, isExtra: true },
        select: { code: true },
      });
      let next =
        rows.reduce((max, r) => {
          const n = Number(r.code.replace(/^X-/, ""));
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 0) + 1;

      for (let attempt = 0; attempt < MAX_EXTRA_ATTEMPTS; attempt += 1) {
        const code = `X-${next}`;
        const inserted = await db.charterCaseControl.createMany({
          data: [
            {
              tenantId: ctx.tenantId,
              useCaseId: uc.id,
              code,
              profileControlCode: null,
              name: data.name,
              category: data.category,
              evidence: data.evidence,
              acceptanceCriteria: data.acceptanceCriteria ?? null,
              role: data.role,
              cadence: data.cadence,
              // Extra vale para o caso qualquer que seja a classe: nasce na mínima.
              minClass: "PUBLIC",
              isExtra: true,
            },
          ],
          skipDuplicates: true,
        });
        if (inserted.count === 0) {
          next += 1;
          continue;
        }

        const created = await db.charterCaseControl.findUnique({
          where: {
            tenantId_useCaseId_code: {
              tenantId: ctx.tenantId,
              useCaseId: uc.id,
              code,
            },
          },
          select: { id: true },
        });
        if (!created) {
          throw new GovernanceError(
            "control.unknown",
            "Controle adicional não encontrado depois do insert."
          );
        }
        await db.charterCaseControlEvent.create({
          data: {
            tenantId: ctx.tenantId,
            caseControlId: created.id,
            action: "START",
            actorId: ctx.userId,
            fromState: null,
            toState: "NO_EVIDENCE",
            comment: null,
          },
        });
        await logCharterAudit(db, ctx, {
          action: "Controle adicional criado",
          entityType: "charter.casecontrol",
          entityId: created.id,
          target: `${uc.code} · ${code} ${data.name}`,
        });
        return code;
      }
      throw new GovernanceError(
        "control.extra.busy",
        "Não foi possível numerar o controle adicional: muitas criações ao mesmo tempo. Tente de novo."
      );
    });
    revalidatePath("/charter", "layout");
    return { controlCode };
  });
}

// ── Quem decide: aceitar, pedir ajuste, dispensar, reabrir ────────────────────

/** Aceita a evidência. Fixa a validade pela cadência do controle. */
export async function acceptControl(
  input: z.input<typeof Ref>
): Promise<Result<{ state: CharterCaseControlState; expiresAt: Date | null }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.decide");
    const data = Ref.parse(input);

    const accepted = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      const control = await loadControl(
        db,
        ctx.tenantId,
        uc.id,
        data.controlCode
      );
      await assertNotProducer({ db, ctx, uc, control, includeCaseOwner: true });
      const acceptedAt = new Date();
      const expiresAt = expiresAtFor(
        control.cadence as ControlCadence,
        acceptedAt
      );
      const state = await applyTransition({
        db,
        ctx,
        uc,
        control,
        action: "ACCEPT",
        auditAction: "ACCEPT",
        patch: { acceptedAt, expiresAt },
        label: "Controle aceito",
      });
      return { state, expiresAt, acceptedAt, useCaseId: uc.id, control };
    });

    // Depois da transação: o anúncio é de um fato já confirmado (X-04).
    await emitProductEvent("charterControlAccepted", {
      tenantId: ctx.tenantId,
      useCaseId: accepted.useCaseId,
      caseControlId: accepted.control.id,
      controlCode: accepted.control.code,
      at: accepted.acceptedAt.toISOString(),
      expiresAt: accepted.expiresAt ? accepted.expiresAt.toISOString() : null,
    });

    revalidatePath("/charter", "layout");
    return { state: accepted.state, expiresAt: accepted.expiresAt };
  });
}

const AdjustSchema = Ref.extend({ comment: Comment });

/** Pede ajuste. Comentário obrigatório. */
export async function requestControlAdjustment(
  input: z.input<typeof AdjustSchema>
): Promise<Result<{ state: CharterCaseControlState }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.decide");
    const data = AdjustSchema.parse(input);

    const state = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      const control = await loadControl(
        db,
        ctx.tenantId,
        uc.id,
        data.controlCode
      );
      await assertNotProducer({
        db,
        ctx,
        uc,
        control,
        includeCaseOwner: false,
      });
      return applyTransition({
        db,
        ctx,
        uc,
        control,
        action: "REQUEST_ADJUSTMENT",
        auditAction: "REQUEST_ADJUSTMENT",
        comment: data.comment,
        label: "Ajuste pedido em controle",
      });
    });
    revalidatePath("/charter", "layout");
    return { state };
  });
}

const DispenseSchema = Ref.extend({
  comment: Comment,
  dispensedUntil: z.coerce.date(),
});

/**
 * Dispensa o controle (CH-PO-04): motivo e prazo de revisão obrigatórios, prazo
 * máximo de 6 meses, só se o perfil deixa dispensar, e nunca o dono do próprio
 * caso. No vencimento do prazo, o job leva o controle a Reaberto.
 */
export async function dispenseControl(
  input: z.input<typeof DispenseSchema>
): Promise<Result<{ state: CharterCaseControlState }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.decide");
    const data = DispenseSchema.parse(input);

    const now = Date.now();
    if (data.dispensedUntil.getTime() <= now) {
      throw new GovernanceError(
        "control.dispense.deadline",
        "O prazo de revisão da dispensa precisa estar no futuro."
      );
    }
    if (data.dispensedUntil.getTime() > now + MAX_DISPENSE_DAYS * 86_400_000) {
      throw new GovernanceError(
        "control.dispense.deadline",
        "O prazo de revisão da dispensa não pode passar de 6 meses."
      );
    }

    const state = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      const control = await loadControl(
        db,
        ctx.tenantId,
        uc.id,
        data.controlCode
      );
      await assertNotProducer({ db, ctx, uc, control, includeCaseOwner: true });
      if (!control.dispensable) {
        throw new GovernanceError(
          "control.notDispensable",
          `${control.code} não pode ser dispensado: o perfil o marca como obrigação legal.`
        );
      }
      return applyTransition({
        db,
        ctx,
        uc,
        control,
        action: "DISPENSE",
        auditAction: "DISPENSE",
        patch: {
          dispensedUntil: data.dispensedUntil,
          dispensedReason: data.comment,
        },
        comment: data.comment,
        label: "Controle dispensado",
      });
    });
    revalidatePath("/charter", "layout");
    return { state };
  });
}

const ReopenSchema = Ref.extend({ comment: Comment });

/** Reabre controle aceito ou dispensado. Comentário obrigatório. A aceitação e a
 *  dispensa anteriores saem do controle; ficam no histórico. */
export async function reopenControl(
  input: z.input<typeof ReopenSchema>
): Promise<Result<{ state: CharterCaseControlState }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.decide");
    const data = ReopenSchema.parse(input);

    const state = await withTenantDb(ctx.tenantId, async (db) => {
      const uc = await loadUseCase(db, ctx.tenantId, data.code);
      const control = await loadControl(
        db,
        ctx.tenantId,
        uc.id,
        data.controlCode
      );
      await assertNotProducer({
        db,
        ctx,
        uc,
        control,
        includeCaseOwner: false,
      });
      return applyTransition({
        db,
        ctx,
        uc,
        control,
        action: "REOPEN",
        auditAction: "REOPEN",
        patch: {
          acceptedAt: null,
          expiresAt: null,
          dispensedUntil: null,
          dispensedReason: null,
        },
        comment: data.comment,
        label: "Controle reaberto",
      });
    });
    revalidatePath("/charter", "layout");
    return { state };
  });
}
