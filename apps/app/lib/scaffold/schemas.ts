import { z } from "zod";
import { cuid, nnStr, optCuid, optStr } from "@/app/actions/_base";
import { WORK_FORMS } from "./forms";

// Schemas Zod do Scaffold.
//
// Os primitivos (`cuid`, `nnStr`, `optStr`, `optCuid`) vêm de `_base.ts` e NÃO
// são redefinidos aqui — constituição §IV. O que este arquivo acrescenta é só o
// que é específico do domínio.

export const ScaffoldPhaseEnum = z.enum(["ASSESS", "PILOT", "SCALE", "EMBED"]);

export const ScaffoldStepStateEnum = z.enum(["TODO", "ACTIVE", "DONE"]);

export const ScaffoldTrackStatusEnum = z.enum([
  "ACTIVE",
  "STALLED",
  "EMBEDDED",
  "CANCELLED",
]);

export const ScaffoldArchetypeEnum = z.enum(WORK_FORMS);

/**
 * Justificativa de override (SG-03).
 *
 * `.trim().min(1)` não basta como intenção: o que se quer barrar é justificativa
 * que existe só para satisfazer o campo. Vinte caracteres é o piso mais baixo
 * que ainda obriga uma frase — abaixo disso cabe "ok" e "urgente", que é
 * exatamente o gate desligado que o PRD §7 nomeia como risco número um.
 */
export const overrideRationale = z
  .string()
  .trim()
  .min(20, "Justificativa precisa dizer por que o critério foi dispensado")
  .max(10_000);

/** Lista de critérios não atendidos num override. Vazia = não há o que
 *  auditar depois, então é recusada na borda e não no serviço. */
export const unmetCriteria = z
  .array(nnStr)
  .min(1, "Informe quais critérios não foram atendidos");

// ── Trilha ────────────────────────────────────────────────────────────────────

export const CreateTrackFromGapSchema = z.object({
  gapId: cuid,
  promotionId: cuid,
  templateId: cuid,
  /** Customização do cliente. Overlay com conflito pendente recusa a criação —
   *  ver `assertOverlayResolved`. */
  overlayId: optCuid,
  /** Diagnóstico de origem (D-27); obrigatório em trilha de prontidão. */
  sourceAssessmentId: optCuid,
  processName: nnStr,
  ownerId: cuid,
  consultantId: optCuid,
  archetype: ScaffoldArchetypeEnum.optional(),
});

export const CreateTrackSchema = z.object({
  templateId: cuid,
  overlayId: optCuid,
  /** Diagnóstico de origem (D-27); obrigatório em trilha de prontidão. */
  sourceAssessmentId: optCuid,
  processName: nnStr,
  ownerId: cuid,
  consultantId: optCuid,
  archetype: ScaffoldArchetypeEnum.optional(),
});

export const ListTracksSchema = z.object({
  status: ScaffoldTrackStatusEnum.optional(),
  phase: ScaffoldPhaseEnum.optional(),
  archetype: ScaffoldArchetypeEnum.optional(),
  ownerId: optCuid,
});

export const TrackIdSchema = z.object({ trackId: cuid });

// ── Acesso ────────────────────────────────────────────────────────────────────

export const ScaffoldRoleEnum = z.enum([
  "TEAM_MEMBER",
  "PROCESS_OWNER",
  "TRANSFORMATION_LEAD",
  "SPONSOR",
  "TEAM_LEAD",
  "CONSULTANT",
  "ADMIN",
]);

/** Sem `tenantId`: o tenant é o da sessão, nunca o da entrada. */
export const AssignScaffoldRoleSchema = z.object({
  userId: cuid,
  role: ScaffoldRoleEnum,
});

export const CancelTrackSchema = z.object({
  trackId: cuid,
  rationale: overrideRationale,
  /** Decisão explícita sobre a apuração do Signal quando há caso assinado.
   *  Sem ela, o cancelamento é recusado — ver TRACK_HAS_SIGNED_BUSINESS_CASE. */
  signalDecision: z.enum(["keep_reading", "stop_reading"]).optional(),
});

// ── Passo ─────────────────────────────────────────────────────────────────────

export const SetStepStateSchema = z.object({
  stepInstanceId: cuid,
  state: ScaffoldStepStateEnum,
  note: optStr,
});

export const AttachArtefactSchema = z.object({
  stepInstanceId: cuid,
  filename: nnStr,
  contentType: nnStr,
  sizeBytes: z.number().int().positive(),
});

export const ReadArtefactSchema = z.object({ artefactId: cuid });

// ── Gate ──────────────────────────────────────────────────────────────────────

/** Veredito por critério, vindo de quem avaliou. `met` ausente conta como não
 *  atendido — ver `evaluateCriteria` em `gate-machine.ts`. */
export const CriterionFactSchema = z.object({
  met: z.boolean(),
  note: optStr,
});

/** Mapa `key do critério` → veredito. Chave livre porque as chaves vêm do
 *  template, e o motor trata chave desconhecida como ruído em vez de erro:
 *  recusar aqui deixaria a trilha presa depois de uma republicação. */
export const CriteriaFactsSchema = z.record(z.string(), CriterionFactSchema);

export const EvaluateGateSchema = z.object({
  phaseInstanceId: cuid,
  criteriaFacts: CriteriaFactsSchema.optional(),
});

export const ClosePhaseSchema = z.object({
  phaseInstanceId: cuid,
  /// Quem assina o gate. Distinto do ator da sessão: quem opera a tela pode
  /// registrar o aceite de quem decidiu, e a trilha guarda os dois.
  approverId: cuid,
  criteriaFacts: CriteriaFactsSchema,
});

/** SG-03. Os dois campos obrigatórios são o produto num registro: o que foi
 *  dispensado, e por quê. O ator NÃO entra aqui — vem da sessão. */
export const OverridePhaseSchema = z.object({
  phaseInstanceId: cuid,
  unmetCriteria,
  rationale: overrideRationale,
});

export const ReopenPhaseSchema = z.object({
  phaseInstanceId: cuid,
  rationale: overrideRationale,
});

export const AcknowledgeCharterPolicySchema = z.object({
  phaseInstanceId: cuid,
  policyId: cuid,
});

// ── Caso de negócio ───────────────────────────────────────────────────────────

export const MetricInputSchema = z.object({
  key: nnStr,
  label: nnStr,
  unit: nnStr,
  /** String, não number: `Decimal` não passa por JSON sem perder precisão, e a
   *  precisão aqui é a promessa. */
  baseValue: z.string().regex(/^-?\d+(\.\d+)?$/, "Número inválido"),
  targetValue: z.string().regex(/^-?\d+(\.\d+)?$/, "Número inválido"),
  direction: z.enum(["DOWN", "UP"]),
  confidence: z.enum(["MEASURED", "ESTIMATED", "DECLARED"]),
  sourceLabel: nnStr,
  sampleLabel: nnStr,
});

export const SaveDraftSchema = z.object({
  businessCaseId: cuid,
  metrics: z.array(MetricInputSchema).max(20),
  /** 1 a 36 meses. Abaixo de 1 não há o que apurar; acima de 36 a promessa
   *  sobrevive ao patrocinador que a assinou. */
  windowMonths: z.number().int().min(1).max(36),
  cadence: z.enum(["monthly", "quarterly"]),
  windowStart: z.coerce.date().optional(),
  benefitKind: z.enum(["COST_AVOIDED", "REVENUE_PROTECTED", "REVENUE_NEW"]),
  benefitHard: z.boolean(),
  benefitAnnualCents: z.number().int().nonnegative().optional(),
  benefitBasis: nnStr,
});

export const BusinessCaseIdSchema = z.object({ businessCaseId: cuid });

/** Nome digitado na superfície de assinatura. Quatro caracteres é o piso do
 *  protótipo — barra "ok" sem barrar nome curto de verdade. */
export const signerName = z
  .string()
  .trim()
  .min(4, "Digite o nome completo de quem assina");

export const SignBusinessCaseSchema = z.object({
  businessCaseId: cuid,
  versionId: cuid,
  signedByLabel: signerName,
});

export const ContestBusinessCaseSchema = z.object({
  businessCaseId: cuid,
  versionId: cuid,
  byLabel: nnStr,
  roleLabel: nnStr,
  /** Objeção precisa dizer o quê. Devolver sem explicar não é objeção — é
   *  silêncio com botão. */
  objection: z.string().trim().min(20, "Descreva a objeção"),
  asks: z.string().trim().min(4, "Diga o que precisa mudar"),
});

export const NewVersionSchema = z.object({
  businessCaseId: cuid,
  note: z.string().trim().min(10, "Diga o que muda nesta versão").max(10_000),
});

// ── Templates e overlays ──────────────────────────────────────────────────────

export const OverlayOpSchema = z.object({
  op: z.enum(["ADD", "REMOVE", "REPLACE"]),
  target: z.enum(["step", "criterion", "deliverable"]),
  key: nnStr,
  patch: z
    .object({
      /** Enunciado do passo ou do critério; título, no entregável. */
      statement: z.string().trim().max(10_000).optional(),
      required: z.boolean().optional(),
      expectedArtefact: nnStr.optional(),
      evaluationType: z.enum(["MANUAL", "DERIVED"]).optional(),
      stepCode: nnStr.optional(),
    })
    .optional(),
  /** Obrigatório em REMOVE de entregável (`validateOverlay`). */
  reason: z.string().trim().max(1000).optional(),
});

export const TemplateIdSchema = z.object({ templateId: cuid });

export const StepTemplateInputSchema = z.object({
  phase: ScaffoldPhaseEnum,
  key: nnStr,
  statement: z.string().trim().min(1).max(10_000),
  expectedArtefact: nnStr,
  required: z.boolean().default(true),
  estimateMinutes: z.number().int().positive().optional(),
});

export const GateCriterionInputSchema = z.object({
  phase: ScaffoldPhaseEnum,
  key: nnStr,
  statement: z.string().trim().min(1).max(10_000),
  evaluationType: z.enum(["MANUAL", "DERIVED"]).default("MANUAL"),
});

export const PublishVersionSchema = z.object({
  templateId: cuid,
  /** "v4". Rótulo é do método, não do banco: quem conversa sobre o template diz
   *  "a v4", e um cuid não serve para conversar. */
  label: nnStr,
  note: z.string().trim().min(10, "Diga o que muda nesta versão").max(10_000),
  steps: z.array(StepTemplateInputSchema).min(1),
  criteria: z.array(GateCriterionInputSchema),
});

export const SaveOverlaySchema = z.object({
  templateId: cuid,
  baseVersionId: cuid,
  name: nnStr,
  ops: z.array(OverlayOpSchema).max(50),
});

export const ResolveConflictSchema = z.object({
  conflictId: cuid,
  /** `keep_overlay` mantém a customização; `take_upstream` aceita o método
   *  novo e descarta a operação; `drop_operation` remove a operação sem
   *  adotar nada. */
  resolution: z.enum(["keep_overlay", "take_upstream", "drop_operation"]),
});

export const ExportBusinessCaseSchema = z.object({
  businessCaseId: cuid,
  /** `v2` é o contrato vigente; `v1` é a derivação achatada do SRD §6, mantida
   *  para quem já leu o documento. */
  shape: z.enum(["v2", "v1"]).optional(),
});

export const ExportHandoverPackSchema = z.object({ trackId: cuid });

// ── Entregável ────────────────────────────────────────────────────────────────

export const DeliverableIdSchema = z.object({ deliverableId: cuid });

/** `comment` é opcional na borda; a regra de obrigatoriedade (ajuste pedido e
 *  reabrir) é da máquina de estados, que conhece a transição. */
export const DeliverableTransitionSchema = z.object({
  deliverableId: cuid,
  comment: z.string().max(10_000).optional(),
});

export const EditDeliverableSummarySchema = z.object({
  deliverableId: cuid,
  summary: z.string().trim().min(1).max(10_000),
});

export const AssignDeliverableSchema = z.object({
  deliverableId: cuid,
  ownerId: optCuid,
  approverId: optCuid,
});

export const AddDeliverableSchema = z.object({
  trackId: cuid,
  phase: ScaffoldPhaseEnum,
  title: nnStr,
  description: z.string().trim().max(10_000),
  kind: z.enum([
    "DOCUMENT",
    "SPREADSHEET",
    "DATASET",
    "CONFIGURATION",
    "SIGNATURE",
    "TRAINING",
    "REPORT",
    "PACKAGE",
  ]),
  producer: z.enum(["OWNER", "CONSULTANT", "TECHNICAL", "LEGAL"]),
  /** Escolha de quem adiciona (SC-PO-04): extra pode ou não travar o gate. */
  required: z.boolean(),
  ownerId: optCuid,
  approverId: optCuid,
});

export const AttachDeliverableVersionSchema = z.object({
  deliverableId: cuid,
  filename: nnStr,
  contentType: nnStr,
  sizeBytes: z.number().int().positive(),
});

export const ReadDeliverableFileSchema = z.object({
  deliverableId: cuid,
  /** Ausente = a versão atual. */
  version: z.number().int().positive().optional(),
});

export const AddDeliverableLinkSchema = z.object({
  deliverableId: cuid,
  provider: z.enum(["COSMOS", "LINEAR", "GITHUB", "JIRA"]),
  externalId: nnStr,
  url: nnStr,
});

export const RemoveDeliverableLinkSchema = z.object({ linkId: cuid });
