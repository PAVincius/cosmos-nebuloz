"use server";

import { withTenantDb } from "@repo/database";
import { SCAFFOLD_ARTEFACT_BUCKET, storageClient } from "@repo/storage";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import {
  declaredTypeAgrees,
  stepArtefactMimeType,
} from "@/lib/scaffold/artefact-type";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import { safeFileName } from "@/lib/scaffold/file-name";
import { canEnterGateReady } from "@/lib/scaffold/gate-machine";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import {
  AttachArtefactSchema,
  ReadArtefactSchema,
  SetStepStateSchema,
} from "@/lib/scaffold/schemas";
import { ensureScaffoldBucket } from "@/lib/scaffold/storage-bucket";
import { type Db, logScaffoldAudit } from "./_shared";

// Passos e artefatos (S-04, SN-02).
//
// A regra que este arquivo NÃO tem: fechar fase. Concluir o último passo
// requerido move a fase para GATE_READY — que é onde o gate passa a poder ser
// avaliado — e nada mais. Fechar por completar tarefa seria fechar sem
// critério, que é o gate desligado.

/** 10 MB, o mesmo teto que `ensureBucket` aplica no bucket. Validar aqui evita
 *  emitir URL de upload para um arquivo que o storage vai recusar depois. */
const MAX_ARTEFACT_BYTES = 10 * 1024 * 1024;

const ARTEFACT_URL_TTL_SECONDS = 300;

async function loadStep(db: Db, tenantId: string, stepInstanceId: string) {
  return db.scaffoldStepInstance.findFirst({
    where: {
      id: stepInstanceId,
      phaseInstance: { track: { tenantId } },
    },
    include: {
      phaseInstance: {
        select: {
          id: true,
          phase: true,
          state: true,
          track: { select: { id: true, code: true, tenantId: true } },
        },
      },
    },
  });
}

/**
 * Marca o passo e, se for o caso, move a fase entre OPEN e GATE_READY.
 *
 * A fase acompanha os passos nos DOIS sentidos. Só avançar seria deixar o gate
 * pronto sobre trabalho que alguém desmarcou depois — e regressão acontece:
 * marcar DONE por engano e desmarcar é o caso comum, não o exótico.
 */
export async function setStepState(
  raw: z.input<typeof SetStepStateSchema>
): Promise<ScaffoldResult<void>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("step.complete");
    const input = SetStepStateSchema.parse(raw);

    await withTenantDb(ctx.tenantId, async (db) => {
      const step = await loadStep(db, ctx.tenantId, input.stepInstanceId);
      if (!step) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }
      // Fase fechada ou em observação não recebe edição de passo: mexer no
      // trabalho depois do gate reescreveria a base sobre a qual a decisão foi
      // tomada, e o snapshot do gate ficaria mentindo.
      const editable =
        step.phaseInstance.state === "OPEN" ||
        step.phaseInstance.state === "GATE_READY" ||
        step.phaseInstance.state === "BLOCKED";
      if (!editable) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }

      const done = input.state === "DONE";
      await db.scaffoldStepInstance.update({
        where: { id: step.id },
        data: {
          state: input.state,
          // Quem não concluiu não assina: desmarcar limpa a autoria.
          completedById: done ? ctx.userId : null,
          completedAt: done ? new Date() : null,
        },
      });

      // Quantos requeridos continuam pendentes DEPOIS desta escrita.
      const pending = await db.scaffoldStepInstance.count({
        where: {
          phaseInstanceId: step.phaseInstanceId,
          required: true,
          state: { not: "DONE" },
          id: { not: step.id },
        },
      });
      const stillPending = pending + (done ? 0 : 1);
      const ready = canEnterGateReady([
        { required: true, state: stillPending === 0 ? "DONE" : "TODO" },
      ]);

      if (ready && step.phaseInstance.state === "OPEN") {
        await db.scaffoldPhaseInstance.update({
          where: { id: step.phaseInstanceId },
          data: { state: "GATE_READY" },
        });
      } else if (!ready && step.phaseInstance.state === "GATE_READY") {
        await db.scaffoldPhaseInstance.update({
          where: { id: step.phaseInstanceId },
          data: { state: "OPEN" },
        });
      }

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.step.set-state",
        entityType: "scaffold.step",
        entityId: step.id,
        target: `${step.phaseInstance.track.code} · ${step.statement}`,
        diff: [["Estado", step.state, input.state]],
      });
    });

    revalidatePath("/scaffold");
  });
}

/**
 * Registra o artefato e devolve URL de upload assinada.
 *
 * O registro nasce antes do byte chegar. É deliberado: um upload que falha
 * deixa uma linha sem objeto, o que é visível e limpável; a ordem inversa
 * deixaria objeto sem linha, que é lixo invisível no bucket.
 */
export async function attachArtefact(
  raw: z.input<typeof AttachArtefactSchema>
): Promise<
  ScaffoldResult<{
    uploadUrl: string;
    artefactId: string;
    objectKey: string;
    contentType: string;
  }>
> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("step.complete");
    const input = AttachArtefactSchema.parse(raw);

    if (input.sizeBytes > MAX_ARTEFACT_BYTES) {
      throw new ScaffoldRuleError("ARTEFACT_TOO_LARGE");
    }
    // O cliente escolhe o arquivo: a extensão é a lista de permissão e o tipo que
    // vale é o dela. O declarado só não pode contradizê-la (um .pdf que se diz
    // text/html), e o PUT usa o canônico.
    const contentType = stepArtefactMimeType(input.filename);
    if (!(contentType && declaredTypeAgrees(contentType, input.contentType))) {
      throw new ScaffoldRuleError("DELIVERABLE_FILE_TYPE_NOT_ALLOWED");
    }
    // O nome vem do navegador: só o último segmento, sem controle nem símbolos de
    // URL. Sem isto, "../../outro-tenant/x.pdf" sai do prefixo do tenant na
    // chave do objeto, e o nome cru ainda iria para dentro do zip do handover.
    const fileName = safeFileName(input.filename);

    const prepared = await withTenantDb(ctx.tenantId, async (db) => {
      const step = await loadStep(db, ctx.tenantId, input.stepInstanceId);
      if (!step) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }
      // Caminho sempre prefixado por tenantId: o bucket é privado, e o prefixo
      // é a segunda linha de defesa se alguma policy do storage afrouxar.
      const objectKey = `${ctx.tenantId}/${step.phaseInstance.track.id}/${step.id}/${fileName}`;
      const artefact = await db.scaffoldArtefact.create({
        data: {
          stepInstanceId: step.id,
          objectKey,
          kind: contentType,
          filename: fileName,
          sizeBytes: input.sizeBytes,
          uploadedById: ctx.userId,
        },
        select: { id: true },
      });
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.artefact.attach",
        entityType: "scaffold.artefact",
        entityId: artefact.id,
        target: `${step.phaseInstance.track.code} · ${fileName}`,
      });
      return { artefactId: artefact.id, objectKey };
    });

    await ensureScaffoldBucket();
    const { data, error } = await storageClient.storage
      .from(SCAFFOLD_ARTEFACT_BUCKET)
      .createSignedUploadUrl(prepared.objectKey);
    if (error || !data) {
      throw new Error(
        `Falha ao emitir URL de upload: ${error?.message ?? "sem resposta"}`
      );
    }

    revalidatePath("/scaffold");
    return {
      uploadUrl: data.signedUrl,
      artefactId: prepared.artefactId,
      objectKey: prepared.objectKey,
      contentType,
    };
  });
}

/**
 * Emite URL assinada de leitura, com a trilha de auditoria gravada antes.
 *
 * A ordem é a regra, não detalhe de implementação (SN-02). O registro é de
 * ACESSO CONCEDIDO, não de byte entregue: se o download não completar, o acesso
 * ainda aconteceu. Mesmo raciocínio que o Meridian escreveu em
 * `requestEvidenceUrl`.
 *
 * A URL do bucket nunca vai para o HTML — se ela vaza, o log não vale nada.
 */
export async function readArtefact(
  raw: z.input<typeof ReadArtefactSchema>
): Promise<ScaffoldResult<{ url: string; expiresIn: number }>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("artefact.read");
    const input = ReadArtefactSchema.parse(raw);

    const artefact = await withTenantDb(ctx.tenantId, async (db) => {
      const a = await db.scaffoldArtefact.findFirst({
        where: {
          id: input.artefactId,
          stepInstance: {
            phaseInstance: { track: { tenantId: ctx.tenantId } },
          },
        },
        include: {
          stepInstance: {
            select: {
              phaseInstance: {
                select: { track: { select: { code: true } } },
              },
            },
          },
        },
      });
      if (!a) {
        throw new ScaffoldRuleError("PHASE_NOT_CLOSABLE");
      }
      await logScaffoldAudit(db, ctx, {
        action: "scaffold.artefact.read",
        entityType: "scaffold.artefact",
        entityId: a.id,
        target: `${a.stepInstance.phaseInstance.track.code} · ${a.filename}`,
        note: "URL assinada emitida para download.",
      });
      return a;
    });

    const { data, error } = await storageClient.storage
      .from(SCAFFOLD_ARTEFACT_BUCKET)
      // `download`: o navegador baixa com o nome do arquivo, em vez de abrir o
      // conteúdo do cliente na origem do storage.
      .createSignedUrl(artefact.objectKey, ARTEFACT_URL_TTL_SECONDS, {
        download: artefact.filename,
      });
    if (error || !data) {
      throw new Error(
        `Falha ao emitir URL de artefato: ${error?.message ?? "sem resposta"}`
      );
    }
    return { url: data.signedUrl, expiresIn: ARTEFACT_URL_TTL_SECONDS };
  });
}
