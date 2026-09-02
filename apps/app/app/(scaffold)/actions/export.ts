"use server";

import { withTenantDb } from "@repo/database";
import { SCAFFOLD_ARTEFACT_BUCKET, storageClient } from "@repo/storage";
import { zipSync } from "fflate";
import type { z } from "zod";
import { type ScaffoldResult, scaffoldAction } from "@/lib/scaffold/action";
import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import { requireScaffoldPermissionContext } from "@/lib/scaffold/guards";
import {
  buildHandoverPack,
  type HandoverInput,
} from "@/lib/scaffold/handover-pack";
import {
  ExportBusinessCaseSchema,
  ExportHandoverPackSchema,
} from "@/lib/scaffold/schemas";
import {
  type ExportableCase,
  type SignalBaselineV1,
  type SignalBaselineV2,
  toSignalV1,
  toSignalV2,
} from "@/lib/scaffold/signal-export";
import { logScaffoldAudit } from "./_shared";

// S-06 — emissão do caso de negócio para o Signal.
//
// Só versão ASSINADA atravessa. Rascunho, aguardando e contestado devolvem
// `NOT_SIGNED`: o Signal não pode apurar contra promessa que ninguém aprovou, e
// é isso que o faz mostrar a iniciativa como "aguardando promessa" em vez de
// zero.
//
// A transformação vive em `lib/scaffold/signal-export.ts`, pura. Aqui fica só o
// guard, a leitura e a trilha de auditoria — emitir o artefato para fora do
// perímetro é evento que precisa de registro.

/** URL do handover vive mais que a de artefato: o pacote é grande e quem o
 *  baixa costuma estar numa reunião de encerramento, não no console. */
const HANDOVER_URL_TTL_SECONDS = 900;

export async function exportBusinessCase(
  raw: z.input<typeof ExportBusinessCaseSchema>
): Promise<ScaffoldResult<SignalBaselineV2 | SignalBaselineV1>> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("portfolio.read");
    const input = ExportBusinessCaseSchema.parse(raw);

    const payload = await withTenantDb(ctx.tenantId, async (db) => {
      const bc = await db.scaffoldBusinessCase.findFirst({
        where: { id: input.businessCaseId, tenantId: ctx.tenantId },
        include: {
          track: { select: { id: true, processName: true } },
          versions: {
            where: { state: "SIGNED" },
            orderBy: { signedAt: "desc" },
            take: 1,
            include: {
              metrics: { orderBy: { key: "asc" } },
            },
          },
        },
      });
      if (!bc) {
        throw new ScaffoldRuleError("NOT_SIGNED");
      }

      const signed = bc.versions[0];
      // A checagem é pela VERSÃO assinada, não pelo estado do caso: um caso em
      // DRAFT com uma v2 assinada por baixo continua exportável — é exatamente
      // o cenário "v2 vigente · v3 em edição".
      if (!(signed && bc.signedVersionId)) {
        throw new ScaffoldRuleError("NOT_SIGNED");
      }

      const exportable: ExportableCase = {
        id: bc.id,
        code: bc.code,
        tenantId: bc.tenantId,
        trackId: bc.track.id,
        processName: bc.track.processName,
        signalInitiativeRef: bc.signalInitiativeRef,
        windowStart: bc.windowStart,
        windowMonths: bc.windowMonths,
        cadence: bc.cadence,
        benefitKind: bc.benefitKind,
        benefitHard: bc.benefitHard,
        benefitAnnualCents:
          bc.benefitAnnualCents == null ? null : Number(bc.benefitAnnualCents),
        benefitBasis: bc.benefitBasis,
        financeReviewedAt: bc.financeReviewedAt,
        signedVersion: {
          label: signed.label,
          contentHash: signed.contentHash,
          signedAt: signed.signedAt,
          signedById: signed.signedById,
          signedByLabel: signed.signedByLabel,
          metrics: signed.metrics.map((m) => ({
            key: m.key,
            label: m.label,
            unit: m.unit,
            baseValue: m.baseValue.toString(),
            targetValue: m.targetValue.toString(),
            direction: m.direction,
            confidence: m.confidence,
            sourceLabel: m.sourceLabel,
            sampleLabel: m.sampleLabel,
          })),
        },
      };

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.businesscase.export",
        entityType: "scaffold.businesscase",
        entityId: bc.id,
        target: `${bc.code} · ${signed.label}`,
        note: `Emitido no shape ${input.shape ?? "v2"} para o Signal. ref ${signed.contentHash ?? "—"}.`,
      });

      return exportable;
    });

    return input.shape === "v1" ? toSignalV1(payload) : toSignalV2(payload);
  });
}

// ── Handover pack ─────────────────────────────────────────────────────────────

/**
 * S-10 / SN-09 — o pacote que o cliente leva.
 *
 * "Auto-contido, legível sem acesso Nebuloz." O `index.html` é montado por
 * `lib/scaffold/handover-pack.ts` sem uma única URL da plataforma; aqui os
 * artefatos são BAIXADOS do storage e embutidos no ZIP. Referenciá-los por URL
 * assinada seria entregar um pacote que expira em cinco minutos.
 *
 * SN-08: nada daqui alimenta treino de modelo. O pacote é montado em memória,
 * entregue e descartado — não há cópia intermediária em lugar nenhum.
 */
export async function exportHandoverPack(
  raw: z.input<typeof ExportHandoverPackSchema>
): Promise<
  ScaffoldResult<{ url: string; expiresIn: number; filename: string }>
> {
  return scaffoldAction(async () => {
    const ctx = await requireScaffoldPermissionContext("artefact.read");
    const input = ExportHandoverPackSchema.parse(raw);

    const prepared = await withTenantDb(ctx.tenantId, async (db) => {
      const track = await db.scaffoldTrack.findFirst({
        where: { id: input.trackId, tenantId: ctx.tenantId },
        include: {
          tenant: { select: { name: true } },
          templateVersion: { select: { label: true } },
          businessCase: {
            include: {
              versions: {
                where: { state: "SIGNED" },
                orderBy: { signedAt: "desc" },
                take: 1,
                include: { metrics: { orderBy: { key: "asc" } } },
              },
            },
          },
          phases: {
            orderBy: { phase: "asc" },
            include: {
              steps: {
                orderBy: { seq: "asc" },
                include: { artefacts: { orderBy: { uploadedAt: "asc" } } },
              },
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

      // O pacote é o encerramento. Gerá-lo de uma trilha em curso entregaria
      // ao cliente um "handover" de trabalho que ainda é nosso.
      const embed = track.phases.find((p) => p.phase === "EMBED");
      if (!embed?.closedAt) {
        throw new ScaffoldRuleError("HANDOVER_NOT_READY");
      }

      const people = await db.user.findMany({
        where: {
          id: {
            in: [track.ownerId, track.consultantId].filter((id): id is string =>
              Boolean(id)
            ),
          },
        },
        select: { id: true, name: true, email: true },
      });
      const nameOf = (id: string | null) => {
        if (!id) {
          return null;
        }
        const u = people.find((x) => x.id === id);
        return u?.name ?? u?.email ?? null;
      };

      const signed = track.businessCase?.versions[0];

      await logScaffoldAudit(db, ctx, {
        action: "scaffold.track.handover-export",
        entityType: "scaffold.track",
        entityId: track.id,
        target: `${track.code} · ${track.processName}`,
        note: "Handover pack emitido. O pacote sai do perímetro da plataforma.",
      });

      return {
        objectKeys: track.phases.flatMap((p) =>
          p.steps.flatMap((s) =>
            s.artefacts.map((a) => ({
              phase: p.phase as string,
              filename: a.filename,
              objectKey: a.objectKey,
            }))
          )
        ),
        input: {
          track: {
            code: track.code,
            processName: track.processName,
            orgName: track.tenant.name,
            archetype: track.archetype,
            templateLabel: track.templateVersion.label,
            startedAt: track.startedAt,
            embeddedAt: track.embeddedAt,
            ownerName: nameOf(track.ownerId),
            consultantName: nameOf(track.consultantId),
          },
          phases: track.phases.map((p) => {
            const r = p.results[0];
            const snapshot = r?.criteriaSnapshot as
              | { statement: string; met: boolean; note: string | null }[]
              | undefined;
            return {
              phase: p.phase as string,
              closedAt: p.closedAt,
              outcome: r?.outcome ?? null,
              approverLabel: r?.approverId ?? null,
              criteria: snapshot ?? [],
              override: r?.override
                ? {
                    actorLabel: r.override.actorId,
                    unmetCriteria: r.override.unmetCriteria,
                    rationale: r.override.rationale,
                    createdAt: r.override.createdAt,
                  }
                : null,
              steps: p.steps.map((s) => ({
                statement: s.statement,
                expectedArtefact: s.expectedArtefact,
                artefacts: s.artefacts.map((a) => ({
                  filename: a.filename,
                  sizeBytes: a.sizeBytes,
                })),
              })),
            };
          }),
          businessCase:
            track.businessCase && signed
              ? {
                  code: track.businessCase.code,
                  versionLabel: signed.label,
                  contentHash: signed.contentHash,
                  signedByLabel: signed.signedByLabel,
                  signedAt: signed.signedAt,
                  metrics: signed.metrics.map((m) => ({
                    label: m.label,
                    unit: m.unit,
                    baseValue: m.baseValue.toString(),
                    targetValue: m.targetValue.toString(),
                    confidence: m.confidence,
                  })),
                }
              : null,
        } satisfies HandoverInput,
      };
    });

    const pack = buildHandoverPack(prepared.input);
    const entries: Record<string, Uint8Array> = {
      "index.html": new TextEncoder().encode(pack.indexHtml),
    };

    // Artefatos EMBUTIDOS, não linkados: uma URL assinada expira em cinco
    // minutos, e o pacote precisa abrir daqui a um ano.
    for (const a of prepared.objectKeys) {
      const { data } = await storageClient.storage
        .from(SCAFFOLD_ARTEFACT_BUCKET)
        .download(a.objectKey);
      if (data) {
        entries[`artefatos/${a.phase}/${a.filename}`] = new Uint8Array(
          await data.arrayBuffer()
        );
      }
      // Artefato ausente no storage não derruba o pacote: o `index.html` já
      // nomeia o que era esperado, e entregar o resto é melhor que entregar
      // nada.
    }

    const zip = zipSync(entries, { level: 6 });
    const key = `${ctx.tenantId}/handover/${pack.archiveName}`;

    await storageClient.storage
      .from(SCAFFOLD_ARTEFACT_BUCKET)
      .upload(key, zip, { contentType: "application/zip", upsert: true });

    const { data, error } = await storageClient.storage
      .from(SCAFFOLD_ARTEFACT_BUCKET)
      .createSignedUrl(key, HANDOVER_URL_TTL_SECONDS);
    if (error || !data) {
      throw new Error(
        `Falha ao emitir URL do handover: ${error?.message ?? "sem resposta"}`
      );
    }

    return {
      url: data.signedUrl,
      expiresIn: HANDOVER_URL_TTL_SECONDS,
      filename: pack.archiveName,
    };
  });
}
