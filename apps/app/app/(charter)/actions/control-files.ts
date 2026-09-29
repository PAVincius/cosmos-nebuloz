"use server";

import { randomUUID } from "node:crypto";
import { withTenantDb } from "@repo/database";
import { CHARTER_EVIDENCE_BUCKET, storageClient } from "@repo/storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isTenantFileKey, nextControlState } from "@/lib/charter/case-controls";
import { ensureEvidenceBucket } from "@/lib/charter/evidence-bucket";
import {
  EVIDENCE_ALLOWED_MIME_TYPES,
  evidenceFileKey,
  evidenceFileName,
  evidenceMimeType,
  MAX_EVIDENCE_BYTES,
} from "@/lib/charter/evidence-file";
import {
  requireCharterContext,
  requireCharterPermissionContext,
} from "@/lib/charter/guards";
import { type Result, safeAction } from "../../actions/_base";
import { type Db, GovernanceError, logCharterAudit } from "./_shared";

// Arquivo de evidência do controle do caso — CH-DEV-05 ("enviar exige arquivo").
//
// Upload por URL assinada de bucket privado: o navegador diz nome, tipo e
// tamanho; a CHAVE é montada aqui (`<tenant>/charter/<caso>/<controle>/
// v<N>-<uuid>/<nome>`), então ninguém escolhe onde grava. O uuid dá a cada envio
// chave própria: reenviar depois de um PUT que falhou não esbarra no objeto que
// já existia. Quem grava a referência no
// controle é `attachControlEvidence` (case-controls.ts), que valida a chave.
// Download: a auditoria é gravada ANTES de emitir a URL, porque qualquer papel
// lê e o log é o que diz quem baixou o quê.

const FILE_URL_TTL_SECONDS = 300;

const Ref = z.object({
  code: z.string().trim().min(1),
  controlCode: z.string().trim().min(1),
});

const UploadSchema = Ref.extend({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().max(255),
  sizeBytes: z.number().int().positive(),
});

async function loadControl(db: Db, tenantId: string, ref: z.infer<typeof Ref>) {
  const uc = await db.charterUseCase.findUnique({
    where: { tenantId_code: { tenantId, code: ref.code } },
    select: { id: true, code: true, title: true, status: true },
  });
  if (!uc) {
    throw new GovernanceError("case.unknown", "Caso não encontrado.");
  }
  const control = await db.charterCaseControl.findUnique({
    where: {
      tenantId_useCaseId_code: {
        tenantId,
        useCaseId: uc.id,
        code: ref.controlCode,
      },
    },
  });
  if (!control) {
    throw new GovernanceError(
      "control.unknown",
      `Controle ${ref.controlCode} não existe neste caso.`
    );
  }
  return { uc, control };
}

export type EvidenceUpload = {
  uploadUrl: string;
  fileKey: string;
  fileName: string;
  contentType: string;
};

/** Emite a URL assinada de upload do arquivo da evidência. */
export async function requestControlEvidenceUpload(
  raw: z.input<typeof UploadSchema>
): Promise<Result<EvidenceUpload>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("case.submit");
    const input = UploadSchema.parse(raw);

    if (input.sizeBytes > MAX_EVIDENCE_BYTES) {
      throw new GovernanceError(
        "control.file.too-large",
        "O arquivo passa de 10 MB. Reduza ou divida a evidência."
      );
    }
    // A extensão é a lista de permissão e o tipo que vale é o dela; o declarado
    // tem de ser IGUAL a ele. "Estar na lista de tipos aceitos" não basta: um
    // .pdf que se diz image/png passaria, e o storage o serviria como imagem.
    const mime = evidenceMimeType(input.filename);
    if (
      !(mime && EVIDENCE_ALLOWED_MIME_TYPES.includes(mime)) ||
      input.contentType !== mime
    ) {
      throw new GovernanceError(
        "control.file.type",
        "Tipo de arquivo não aceito como evidência. Use PDF, Office, imagem, CSV ou texto."
      );
    }

    // Chamada de rede FORA da transação: dentro dela prenderia a conexão do banco
    // enquanto o Supabase Storage responde.
    await ensureEvidenceBucket();

    const out = await withTenantDb(ctx.tenantId, async (db) => {
      const { uc, control } = await loadControl(db, ctx.tenantId, input);
      try {
        nextControlState(control.state, "ATTACH");
      } catch {
        throw new GovernanceError(
          "control.file.state",
          "Este controle não recebe arquivo no estado atual. Reabra antes de anexar."
        );
      }

      // Cada anexo é uma versão nova no caminho: os arquivos anteriores seguem no
      // storage, e o histórico do controle guarda só o nome.
      const previous = await db.charterCaseControlEvent.count({
        where: {
          tenantId: ctx.tenantId,
          caseControlId: control.id,
          action: "ATTACH",
        },
      });
      const fileKey = evidenceFileKey({
        tenantId: ctx.tenantId,
        caseCode: uc.code,
        controlCode: control.code,
        version: previous + 1,
        uploadId: randomUUID(),
        filename: input.filename,
      });

      const { data, error } = await storageClient.storage
        .from(CHARTER_EVIDENCE_BUCKET)
        .createSignedUploadUrl(fileKey);
      if (error || !data) {
        throw new Error(
          `Falha ao emitir URL de upload: ${error?.message ?? "sem resposta"}`
        );
      }

      await logCharterAudit(db, ctx, {
        action: "Envio de evidência solicitado",
        entityType: "charter.casecontrol",
        entityId: control.id,
        target: `${uc.code} · ${control.code} ${control.name}`,
        note: evidenceFileName(input.filename),
      });
      return {
        uploadUrl: data.signedUrl,
        fileKey,
        fileName: evidenceFileName(input.filename),
        contentType: mime,
      };
    });

    revalidatePath(`/charter/case/${input.code}`);
    return out;
  });
}

/** URL assinada de leitura do arquivo do controle, com a auditoria gravada ANTES
 *  de emitir. Qualquer papel do Charter lê (o Auditor inclusive). */
export async function readControlEvidenceFile(
  raw: z.input<typeof Ref>
): Promise<Result<{ url: string; fileName: string }>> {
  return await safeAction(async () => {
    const ctx = await requireCharterContext();
    const input = Ref.parse(raw);

    const target = await withTenantDb(ctx.tenantId, async (db) => {
      const { uc, control } = await loadControl(db, ctx.tenantId, input);
      if (!(control.fileKey && control.fileName)) {
        throw new GovernanceError(
          "control.file.none",
          "Este controle não tem arquivo anexado."
        );
      }
      // Defesa em profundidade: a chave gravada já foi validada ao anexar, e é
      // revalidada antes de assinar.
      if (!isTenantFileKey(ctx.tenantId, control.fileKey)) {
        throw new GovernanceError(
          "control.file.tenant",
          "Arquivo fora do armazenamento desta organização."
        );
      }
      await logCharterAudit(db, ctx, {
        action: "Evidência baixada",
        entityType: "charter.casecontrol",
        entityId: control.id,
        target: `${uc.code} · ${control.code} ${control.name}`,
        note: control.fileName,
      });
      return { fileKey: control.fileKey, fileName: control.fileName };
    });

    const { data, error } = await storageClient.storage
      .from(CHARTER_EVIDENCE_BUCKET)
      .createSignedUrl(target.fileKey, FILE_URL_TTL_SECONDS, {
        download: target.fileName,
      });
    if (error || !data) {
      throw new Error(
        `Falha ao emitir URL de leitura: ${error?.message ?? "sem resposta"}`
      );
    }
    return { url: data.signedUrl, fileName: target.fileName };
  });
}
