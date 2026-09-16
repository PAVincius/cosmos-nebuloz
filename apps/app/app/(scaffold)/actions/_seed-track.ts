import "server-only";

import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import { PHASE_ORDER } from "@/lib/scaffold/phases";
import { type Db, nextCode } from "./_shared";

// Semeadura de trilha — o que `createTrack` e `createTrackFromGap` têm em
// comum. A criação é o ponto em que o método vira trabalho: a versão do
// template é PINADA aqui e nunca migra (ST-03), e os textos de passo são
// COPIADOS em vez de lidos por join, para que publicar uma versão nova não
// reescreva o enunciado de um passo que alguém já executou.

/**
 * Resolve a versão publicada mais recente do template.
 *
 * Template sem versão publicada é recusado em vez de criar trilha vazia: uma
 * trilha sem passos parece um bug de renderização, e a causa real (ninguém
 * publicou o método) ficaria a três telas de distância.
 */
async function resolveTemplateVersion(db: Db, templateId: string) {
  const version = await db.scaffoldTemplateVersion.findFirst({
    where: { templateId },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      label: true,
      steps: {
        select: {
          phase: true,
          seq: true,
          key: true,
          statement: true,
          expectedArtefact: true,
          required: true,
        },
        orderBy: { seq: "asc" },
      },
    },
  });
  if (!version) {
    throw new ScaffoldRuleError("TEMPLATE_HAS_NO_PUBLISHED_VERSION");
  }
  return version;
}

export type SeedInput = {
  tenantId: string;
  processName: string;
  ownerId: string;
  consultantId?: string;
  archetype?: "TRIAGE" | "DOC_REVIEW" | "REPORTING";
  templateId: string;
  overlayId?: string;
  sourceGapId?: string;
  sourcePromotionId?: string;
};

/**
 * Overlay com conflito pendente não gera trilha — ST-02.
 *
 * Uma trilha criada sobre conflito não sabe quais passos são os seus: o overlay
 * diz uma coisa, a versão nova do método diz outra, e ninguém decidiu. Melhor
 * recusar a criação do que entregar ao cliente uma trilha cujo conteúdo
 * depende de uma discordância não resolvida.
 */
async function assertOverlayResolved(
  db: Db,
  tenantId: string,
  overlayId: string | undefined
): Promise<void> {
  if (!overlayId) {
    return;
  }
  const pending = await db.scaffoldOverlayConflict.count({
    where: { tenantId, overlayId, resolvedAt: null },
  });
  if (pending > 0) {
    throw new ScaffoldRuleError("OVERLAY_HAS_UNRESOLVED_CONFLICT");
  }
}

/**
 * Cria a trilha e instancia as quatro fases com seus passos, numa transação.
 *
 * ASSESS nasce OPEN; as outras três nascem IDLE. Criar as quatro de uma vez, em
 * vez de sob demanda, é o que permite ao portfólio mostrar a progressão inteira
 * sem inventar linhas que ainda não existem.
 */
export async function seedTrack(db: Db, input: SeedInput) {
  await assertOverlayResolved(db, input.tenantId, input.overlayId);
  const version = await resolveTemplateVersion(db, input.templateId);
  const code = await nextCode({
    db,
    tenantId: input.tenantId,
    kind: "track",
    prefix: "TR",
  });

  return db.scaffoldTrack.create({
    data: {
      tenantId: input.tenantId,
      code,
      processName: input.processName,
      archetype: input.archetype ?? null,
      ownerId: input.ownerId,
      consultantId: input.consultantId ?? null,
      templateVersionId: version.id,
      overlayId: input.overlayId ?? null,
      sourceGapId: input.sourceGapId ?? null,
      sourcePromotionId: input.sourcePromotionId ?? null,
      phases: {
        create: PHASE_ORDER.map((phase) => ({
          phase,
          state: phase === "ASSESS" ? ("OPEN" as const) : ("IDLE" as const),
          openedAt: phase === "ASSESS" ? new Date() : null,
          steps: {
            create: version.steps
              .filter((s) => s.phase === phase)
              .map((s) => ({
                stepTemplateKey: s.key,
                seq: s.seq,
                // Cópia, não join — ST-03. Ver o comentário no modelo.
                statement: s.statement,
                expectedArtefact: s.expectedArtefact,
                required: s.required,
              })),
          },
        })),
      },
    },
    select: { id: true, code: true },
  });
}
