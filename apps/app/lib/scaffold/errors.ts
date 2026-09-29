// Erros nomeados do Scaffold.
//
// Os de gate (SG-*) não são detalhe de UX: o SRD trata qualquer caminho que
// feche uma fase sem critérios atendidos ou override atribuído como defeito de
// correção de severidade máxima. Cada recusa tem código próprio para que o
// teste negativo asserte a razão exata, e não só "deu erro" — um teste que
// aceita qualquer falha passa mesmo quando o produto falha pelo motivo errado.

/** Códigos de recusa. O valor é o próprio nome: é o que aparece no teste, no
 *  log e no `Result.code`. */
export const SCAFFOLD_ERROR = {
  // Trilha
  GAP_ALREADY_PROMOTED: "GAP_ALREADY_PROMOTED",
  TEMPLATE_HAS_NO_PUBLISHED_VERSION: "TEMPLATE_HAS_NO_PUBLISHED_VERSION",
  OVERLAY_HAS_UNRESOLVED_CONFLICT: "OVERLAY_HAS_UNRESOLVED_CONFLICT",
  TRACK_HAS_SIGNED_BUSINESS_CASE: "TRACK_HAS_SIGNED_BUSINESS_CASE",
  PROMOTION_HAS_ACTIVE_TRACK: "PROMOTION_HAS_ACTIVE_TRACK",
  // Gate — SG-01..SG-05
  STEPS_INCOMPLETE: "STEPS_INCOMPLETE",
  CRITERIA_UNMET: "CRITERIA_UNMET",
  BASELINE_NOT_SIGNED: "BASELINE_NOT_SIGNED",
  CHARTER_POLICY_NOT_ACKED: "CHARTER_POLICY_NOT_ACKED",
  RATIONALE_REQUIRED: "RATIONALE_REQUIRED",
  UNMET_CRITERIA_REQUIRED: "UNMET_CRITERIA_REQUIRED",
  PHASE_NOT_CLOSABLE: "PHASE_NOT_CLOSABLE",
  // Passo e artefato
  ARTEFACT_TOO_LARGE: "ARTEFACT_TOO_LARGE",
  // Caso de negócio
  VERSION_IMMUTABLE: "VERSION_IMMUTABLE",
  NOT_SIGNED: "NOT_SIGNED",
  HANDOVER_NOT_READY: "HANDOVER_NOT_READY",
  // Registro único de processo (X-01)
  PROCESS_LINK_EMPTY: "PROCESS_LINK_EMPTY",
  PROCESS_LINK_TARGET_NOT_FOUND: "PROCESS_LINK_TARGET_NOT_FOUND",
  PROCESS_LINK_CONFLICT: "PROCESS_LINK_CONFLICT",
  // Gate da SCALE lê os controles do Charter (CH-PM-03)
  CHARTER_CONTROLS_NOT_CLEAR: "CHARTER_CONTROLS_NOT_CLEAR",
} as const;

export type ScaffoldErrorCode =
  (typeof SCAFFOLD_ERROR)[keyof typeof SCAFFOLD_ERROR];

/** Mensagem pt-BR de cada recusa. Diz o que aconteceu E o que destrava —
 *  recusa que não diz como sair vira ticket de suporte. */
export const SCAFFOLD_ERROR_MESSAGE: Record<ScaffoldErrorCode, string> = {
  GAP_ALREADY_PROMOTED:
    "Esta lacuna já foi promovida para uma trilha. Abra a trilha existente ou revogue a promoção antes de criar outra.",
  TEMPLATE_HAS_NO_PUBLISHED_VERSION:
    "O template escolhido não tem versão publicada. Publique uma versão antes de criar trilhas com ele.",
  OVERLAY_HAS_UNRESOLVED_CONFLICT:
    "O overlay escolhido tem conflito pendente contra a versão base. Resolva o conflito antes de criar a trilha — trilha criada sobre conflito não sabe quais passos são os seus.",
  TRACK_HAS_SIGNED_BUSINESS_CASE:
    "Esta trilha tem caso de negócio assinado. Cancelar exige decidir explicitamente o que acontece com a apuração do Signal.",
  PROMOTION_HAS_ACTIVE_TRACK:
    "A promoção tem trilha ativa. Cancele a trilha antes de revogar a promoção — revogar aqui deixaria trabalho em curso sem origem.",
  STEPS_INCOMPLETE:
    "Há passo requerido não concluído nesta fase. Um gate só é avaliado depois que o trabalho da fase terminou.",
  CRITERIA_UNMET:
    "Há critério de gate não atendido. Atenda o critério ou registre um override com justificativa nominal.",
  BASELINE_NOT_SIGNED:
    "A Fase 1 não fecha sem caso de negócio assinado. Envie para assinatura e obtenha o aceite do patrocinador.",
  CHARTER_POLICY_NOT_ACKED:
    "A Fase 3 não fecha sem o aceite da política do Charter aplicável ao fluxo.",
  RATIONALE_REQUIRED:
    "Override exige justificativa escrita. Override sem justificativa não é decisão registrada — é gate desligado.",
  UNMET_CRITERIA_REQUIRED:
    "Override exige a lista dos critérios que não foram atendidos. Sem ela, não há o que auditar depois.",
  PHASE_NOT_CLOSABLE:
    "A fase não está num estado que permita fechamento. Verifique se ela já foi fechada ou ainda não abriu.",
  ARTEFACT_TOO_LARGE:
    "Artefato acima do limite de 10 MB. Anexe um link para o arquivo grande e mantenha no pacote só o que precisa sobreviver ao handover.",
  VERSION_IMMUTABLE:
    "Esta versão do caso de negócio não é mais editável. Crie uma versão nova a partir dela — a assinada permanece intacta.",
  NOT_SIGNED:
    "O caso de negócio ainda não foi assinado. O Signal não apura contra promessa não assinada.",
  HANDOVER_NOT_READY:
    "O handover pack só é emitido depois que o gate da Fase 4 fecha. Antes disso, o trabalho ainda é da Nebuloz.",
  PROCESS_LINK_EMPTY:
    "Informe ao menos um id (lacuna, trilha, iniciativa ou caso de uso) para ligar ao processo.",
  PROCESS_LINK_TARGET_NOT_FOUND:
    "Algum dos itens informados não existe nesta organização. Confira o id de cada produto.",
  PROCESS_LINK_CONFLICT:
    "Estes itens já estão ligados a processos diferentes, ou o processo já aponta para outro item no mesmo produto. Resolva o vínculo existente antes de ligar de novo.",
  CHARTER_CONTROLS_NOT_CLEAR:
    "A Fase 3 não fecha com controle do Charter sem evidência, com ajuste pedido, vencido ou reaberto no caso de uso ligado a esta trilha. Aceite ou dispense os controles pendentes no Charter.",
};

/**
 * Regra de domínio do Scaffold violada.
 *
 * Distinto de `AuthError.FORBIDDEN` (403, falta permissão): aqui a pessoa PODE
 * agir, mas o estado não permite. `status` 422, como o `MeridianRuleError`.
 *
 * `blockers` carrega o que precisa ser resolvido — passos pendentes, critérios
 * não atendidos — para a UI listar em vez de mandar a pessoa procurar.
 */
export class ScaffoldRuleError extends Error {
  readonly code: ScaffoldErrorCode;
  readonly status = 422;
  readonly blockers: string[];

  constructor(code: ScaffoldErrorCode, blockers: string[] = []) {
    super(SCAFFOLD_ERROR_MESSAGE[code]);
    this.name = "ScaffoldRuleError";
    this.code = code;
    this.blockers = blockers;
  }
}
