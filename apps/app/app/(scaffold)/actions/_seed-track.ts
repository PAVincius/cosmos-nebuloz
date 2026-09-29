import "server-only";

import { ScaffoldRuleError } from "@/lib/scaffold/errors";
import type { WorkFormCode } from "@/lib/scaffold/forms";
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
      // A forma do trabalho é do template: a tela não a manda, e a trilha não
      // pode ficar "sem arquétipo" (Crivo F4).
      template: { select: { archetype: true } },
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
  /** Quem abre o rascunho do caso de negócio: o ator da sessão. */
  authorId: string;
  consultantId?: string;
  archetype?: WorkFormCode;
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
 * O dono do processo é PROCESS_OWNER e o consultor, CONSULTANT (Crivo F3).
 *
 * Dono com outro papel deixa a trilha sem quem produza e aprove o que é do dono
 * e sem quem assine o caso de negócio (`businesscase.sign` é só do dono do
 * processo). Vale no servidor: a tela filtra o seletor, mas quem manda o id é
 * o cliente.
 */
async function assertTrackPeople(db: Db, input: SeedInput): Promise<void> {
  const owner = await db.scaffoldMembership.findFirst({
    where: {
      tenantId: input.tenantId,
      userId: input.ownerId,
      role: "PROCESS_OWNER",
    },
    select: { userId: true },
  });
  if (!owner) {
    throw new ScaffoldRuleError("OWNER_NOT_PROCESS_OWNER");
  }
  if (input.consultantId) {
    const consultant = await db.scaffoldMembership.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: input.consultantId,
        role: "CONSULTANT",
      },
      select: { userId: true },
    });
    if (!consultant) {
      throw new ScaffoldRuleError("CONSULTANT_NOT_CONSULTANT");
    }
  }
}

/**
 * Cria a trilha e instancia as quatro fases com seus passos, numa transação.
 *
 * ASSESS nasce OPEN; as outras três nascem IDLE. Criar as quatro de uma vez, em
 * vez de sob demanda, é o que permite ao portfólio mostrar a progressão inteira
 * sem inventar linhas que ainda não existem.
 *
 * O caso de negócio nasce junto, em rascunho (SB-01). `saveDraft`, o envio e a
 * assinatura exigem um caso com versão em edição, e nenhuma outra action o cria:
 * sem ele, a Fase 1 não fecha (SG-04) e não há saída pela tela.
 */
export async function seedTrack(db: Db, input: SeedInput) {
  await assertTrackPeople(db, input);
  await assertOverlayResolved(db, input.tenantId, input.overlayId);
  const version = await resolveTemplateVersion(db, input.templateId);
  const code = await nextCode({
    db,
    tenantId: input.tenantId,
    kind: "track",
    prefix: "TR",
  });

  const track = await db.scaffoldTrack.create({
    data: {
      tenantId: input.tenantId,
      code,
      processName: input.processName,
      archetype: input.archetype ?? version.template.archetype,
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

  const businessCaseCode = await openBusinessCase(db, input, track.id);
  await instantiateDeliverables(db, {
    tenantId: input.tenantId,
    trackId: track.id,
    versionId: version.id,
    people: {
      ownerId: input.ownerId,
      consultantId: input.consultantId ?? null,
    },
  });
  return { ...track, businessCaseCode };
}

const MODULE_LABEL: Record<string, string> = { CHARTER: "Charter" };

type TrackPeople = { ownerId: string; consultantId: string | null };

/**
 * Responsável e aprovador padrão de um entregável (backlog DEV-06): o dono do
 * processo aprova o que não é dele, e a consultora aprova o que é do dono. O
 * que o cliente produz (produtor OWNER) é do dono; o resto é da consultoria.
 * Sem consultora, esse resto fica sem responsável, e o dono o aprova.
 *
 * É o que impede a mesma pessoa de iniciar, enviar e aprovar: com responsável e
 * aprovador distintos, "ninguém aprova o que é seu" tem sobre o que valer.
 */
function defaultPeople(producer: string, p: TrackPeople) {
  return producer === "OWNER"
    ? { ownerId: p.ownerId, approverId: p.consultantId }
    : { ownerId: p.consultantId, approverId: p.ownerId };
}

/**
 * Entregáveis da trilha, copiados do template pinado (SC-DEV-02, ST-03).
 *
 * Versão de template sem entregáveis (as anteriores a este modelo) não gera
 * nada: a trilha segue só a regra de passos. Entregável que depende de módulo
 * não contratado (C1.1 e o Charter) nasce dispensado pelo sistema, com o motivo
 * gravado, e por isso deixa de ser obrigatório: é a única exceção à regra de que
 * todo entregável do template trava o gate.
 */
async function instantiateDeliverables(
  db: Db,
  {
    tenantId,
    trackId,
    versionId,
    people,
  }: {
    tenantId: string;
    trackId: string;
    versionId: string;
    people: TrackPeople;
  }
): Promise<void> {
  const templates = await db.scaffoldDeliverableTemplate.findMany({
    where: { versionId },
    orderBy: [{ phase: "asc" }, { seq: "asc" }],
  });
  if (templates.length === 0) {
    return;
  }

  const phases = await db.scaffoldPhaseInstance.findMany({
    where: { trackId, track: { tenantId } },
    select: { id: true, phase: true },
  });
  const phaseId = new Map(phases.map((p) => [p.phase, p.id]));

  const modules = [
    ...new Set(
      templates.flatMap((t) => (t.requiresModule ? [t.requiresModule] : []))
    ),
  ];
  const contracted = new Set<string>();
  for (const module of modules) {
    const active = await db.tenantModule.findFirst({
      where: {
        tenantId,
        module,
        status: { in: ["ACTIVE", "TRIAL"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { module: true },
    });
    if (active) {
      contracted.add(module);
    }
  }

  await db.scaffoldDeliverableInstance.createMany({
    data: templates.map((t) => {
      const dispensed = t.requiresModule && !contracted.has(t.requiresModule);
      return {
        tenantId,
        trackId,
        phaseInstanceId: phaseId.get(t.phase) as string,
        stepCode: t.stepCode,
        code: t.code,
        templateKey: t.code,
        title: t.title,
        description: t.description,
        kind: t.kind,
        producer: t.producer,
        isExtra: false,
        required: dispensed ? false : t.required,
        dispensedReason: dispensed
          ? `O módulo ${MODULE_LABEL[t.requiresModule as string] ?? t.requiresModule} não está contratado por esta organização; dispensado pelo sistema.`
          : null,
        status: "NOT_STARTED" as const,
        ...defaultPeople(t.producer, people),
      };
    }),
  });
}

/**
 * Caso de negócio em rascunho (v1) ligado à trilha recém-criada.
 *
 * O patrocinador provisório é o dono do processo: a matriz dá
 * `businesscase.sign` a esse papel. `benefitBasis` fica vazio de propósito —
 * é rascunho, e `saveDraft` exige o texto antes de qualquer envio. `currentVersionId` é
 * escrito depois, porque a versão só ganha id ao ser criada; `signedVersionId`
 * fica nulo até `signBusinessCase`.
 */
async function openBusinessCase(
  db: Db,
  input: SeedInput,
  trackId: string
): Promise<string> {
  const code = await nextCode({
    db,
    tenantId: input.tenantId,
    kind: "businesscase",
    prefix: "BC",
  });
  const bc = await db.scaffoldBusinessCase.create({
    data: {
      tenantId: input.tenantId,
      trackId,
      code,
      state: "DRAFT",
      sponsorId: input.ownerId,
      sponsorRoleLabel: "Dono do processo",
      authorId: input.authorId,
      benefitBasis: "",
      versions: {
        create: {
          tenantId: input.tenantId,
          label: "v1",
          state: "DRAFT",
          note: "Versão inicial, aberta com a trilha.",
          authoredById: input.authorId,
        },
      },
    },
    select: { id: true, versions: { select: { id: true } } },
  });
  await db.scaffoldBusinessCase.update({
    where: { id: bc.id },
    data: { currentVersionId: bc.versions[0]?.id },
  });
  return code;
}
