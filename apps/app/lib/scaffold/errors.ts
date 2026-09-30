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
  OVERLAY_NOT_FOUND: "OVERLAY_NOT_FOUND",
  OVERLAY_VIOLATES_GATE_RULES: "OVERLAY_VIOLATES_GATE_RULES",
  TRACK_HAS_SIGNED_BUSINESS_CASE: "TRACK_HAS_SIGNED_BUSINESS_CASE",
  PROMOTION_HAS_ACTIVE_TRACK: "PROMOTION_HAS_ACTIVE_TRACK",
  // Acesso
  MEMBER_NOT_IN_TENANT: "MEMBER_NOT_IN_TENANT",
  OWNER_NOT_PROCESS_OWNER: "OWNER_NOT_PROCESS_OWNER",
  CONSULTANT_NOT_CONSULTANT: "CONSULTANT_NOT_CONSULTANT",
  ROLE_ASSIGNMENT_FORBIDDEN: "ROLE_ASSIGNMENT_FORBIDDEN",
  SELF_ROLE_CHANGE: "SELF_ROLE_CHANGE",
  // Gate — SG-01..SG-05
  STEPS_INCOMPLETE: "STEPS_INCOMPLETE",
  DELIVERABLES_PENDING: "DELIVERABLES_PENDING",
  DELIVERABLE_NOT_FOUND: "DELIVERABLE_NOT_FOUND",
  DELIVERABLE_TRANSITION_INVALID: "DELIVERABLE_TRANSITION_INVALID",
  DELIVERABLE_COMMENT_REQUIRED: "DELIVERABLE_COMMENT_REQUIRED",
  DELIVERABLE_SELF_REVIEW: "DELIVERABLE_SELF_REVIEW",
  DELIVERABLE_FILE_REQUIRED: "DELIVERABLE_FILE_REQUIRED",
  DELIVERABLE_PHASE_NOT_OPEN: "DELIVERABLE_PHASE_NOT_OPEN",
  DELIVERABLE_NO_FILE: "DELIVERABLE_NO_FILE",
  DELIVERABLE_FILE_TYPE_NOT_ALLOWED: "DELIVERABLE_FILE_TYPE_NOT_ALLOWED",
  DELIVERABLE_ASSIGNEE_NOT_ELIGIBLE: "DELIVERABLE_ASSIGNEE_NOT_ELIGIBLE",
  DELIVERABLE_LINK_INVALID: "DELIVERABLE_LINK_INVALID",
  DELIVERABLE_LINK_DUPLICATE: "DELIVERABLE_LINK_DUPLICATE",
  DELIVERABLE_LINK_LIMIT: "DELIVERABLE_LINK_LIMIT",
  DELIVERABLE_LINK_NOT_FOUND: "DELIVERABLE_LINK_NOT_FOUND",
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
  OVERLAY_NOT_FOUND:
    "O overlay escolhido não existe nesta organização. Escolha outro, ou crie a trilha sem overlay — trilha criada sem a customização que o cliente pediu seria uma surpresa.",
  OVERLAY_VIOLATES_GATE_RULES:
    "O overlay tira do gate algo que o método exige: dispensar entregável obrigatório sem ser consultor, remover sem motivo, remover passo que deixa entregável obrigatório sem produtor, ou alterar critério de gate (o gate lê a versão do método, não o overlay). Ajuste as operações apontadas — gate que se desliga por overlay deixa de ser gate.",
  TRACK_HAS_SIGNED_BUSINESS_CASE:
    "Esta trilha tem caso de negócio assinado. Cancelar exige decidir explicitamente o que acontece com a apuração do Signal.",
  PROMOTION_HAS_ACTIVE_TRACK:
    "A promoção tem trilha ativa. Cancele a trilha antes de revogar a promoção — revogar aqui deixaria trabalho em curso sem origem.",
  MEMBER_NOT_IN_TENANT:
    "Esta pessoa não faz parte da organização. Convide-a para a organização antes de atribuir um papel de adoção.",
  OWNER_NOT_PROCESS_OWNER:
    "O dono do processo precisa ter o papel de dono do processo no Scaffold. Quem só lê, ou é da consultoria, não produz nem assina o que é do dono. Atribua o papel em Papéis de adoção.",
  CONSULTANT_NOT_CONSULTANT:
    "O consultor da trilha precisa ter o papel de consultor no Scaffold.",
  ROLE_ASSIGNMENT_FORBIDDEN:
    "Seu papel não pode conceder nem retirar este papel. Só o administrador gere administrador e consultor; o consultor gere os papéis abaixo dele.",
  SELF_ROLE_CHANGE:
    "Ninguém altera o próprio papel de adoção. Peça a outra pessoa com permissão para fazê-lo.",
  DELIVERABLE_NOT_FOUND: "Entregável não encontrado nesta organização.",
  DELIVERABLE_TRANSITION_INVALID:
    "O entregável não está num estado que permita esta ação. Atualize a tela: outra pessoa pode ter movido o entregável.",
  DELIVERABLE_COMMENT_REQUIRED:
    "Pedir ajuste e reabrir exigem um comentário de ao menos 10 caracteres dizendo o motivo.",
  DELIVERABLE_SELF_REVIEW:
    "Responsável e aprovador não podem ser a mesma pessoa: ninguém aprova o que é seu.",
  DELIVERABLE_FILE_REQUIRED:
    "Anexe o arquivo do entregável antes de enviar para revisão.",
  DELIVERABLE_PHASE_NOT_OPEN:
    "A fase deste entregável ainda não abriu: ele é só leitura até o gate da fase anterior fechar.",
  DELIVERABLE_NO_FILE: "Este entregável não tem arquivo nessa versão.",
  DELIVERABLE_ASSIGNEE_NOT_ELIGIBLE:
    "Esta pessoa não pode ser designada. O responsável precisa de papel no Scaffold que trabalhe no entregável, e o aprovador, de um que revise; quem só lê não produz nem aprova.",
  DELIVERABLE_LINK_INVALID:
    "Vínculo recusado. O link precisa ser de um host aceito para o provedor.",
  DELIVERABLE_LINK_DUPLICATE: "Este item já está ligado a este entregável.",
  DELIVERABLE_LINK_LIMIT:
    "Este entregável já tem 20 vínculos, o máximo. Remova algum antes de ligar outro.",
  DELIVERABLE_LINK_NOT_FOUND: "Vínculo não encontrado nesta organização.",
  DELIVERABLE_FILE_TYPE_NOT_ALLOWED:
    "Tipo de arquivo não aceito. Anexe PDF, Word (docx), Excel (xlsx), PowerPoint (pptx), imagem (png, jpg), CSV ou texto (txt).",
  DELIVERABLES_PENDING:
    "Há entregável obrigatório fora de Aprovado nesta fase. Aprove os entregáveis antes de revisar e assinar; override não dispensa esta condição.",
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
