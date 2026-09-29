// charter-control-profiles.ts — os 5 perfis de controle do Charter como dado.
//
// Fonte: decisões provisórias do Norte, 2026-09-29, seção f, CH-PO-01..04
// (docs/produto/decisoes-provisorias-2026-09-29.md).
//
// RASCUNHO. O aceite do PDF exige assinatura de Jurídico/DPO e de Segurança
// (CH-PO-01) e a Nebuloz não pode publicar sem elas. Por isso o seed grava as
// versões SEM assinatura (legalSignedBy e securitySignedBy nulos): o perfil
// existe para o dev modelar e testar, e a action `isPublishable` o recusa em
// caso real até as duas assinaturas. Os critérios de aceite em texto livre
// abaixo derivam da evidência descrita pelo Norte; onde ele não deu limite, vale
// o critério geral de CH-PO-02 (arquivo, data de produção, quem produziu).
//
// Hipóteses do Norte: AN-1 usa 1,5× a média.

export type WorkFormSeed =
  | "CONVERSATIONAL"
  | "ANALYSIS"
  | "DOC_REVIEW"
  | "TRIAGE"
  | "REPORTING";
export type RiskSeed =
  | "PRIVACY"
  | "REGULATORY"
  | "SECURITY"
  | "BIAS"
  | "IP"
  | "OPERATIONAL"
  | "REPUTATIONAL";
export type RoleSeed = "COMPLIANCE" | "LEGAL" | "SECURITY";
export type CadenceSeed =
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUAL"
  | "ANNUAL"
  | "PER_CYCLE";
export type ClassSeed = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export type ControlSeed = {
  code: string;
  name: string;
  category: RiskSeed;
  evidence: string;
  acceptanceCriteria: string;
  role: RoleSeed;
  cadence: CadenceSeed;
  minClass: ClassSeed;
  /** CH-PO-04: false = não pode ser dispensado (obrigação legal). */
  dispensable?: boolean;
};

export type ControlProfileSeed = {
  workForm: WorkFormSeed;
  name: string;
  label: string;
  dominantRisks: RiskSeed[];
  decisionRole: RoleSeed;
  note: string;
  controls: ControlSeed[];
};

const NOTE =
  "Rascunho das decisões provisórias do Norte (2026-09-29, CH-PO-01). Sem as assinaturas de Jurídico/DPO e de Segurança, não pode ser publicado para caso real.";
const GERAL =
  "Evidência que um terceiro verifica sem perguntar a ninguém: arquivo, data de produção e quem produziu (CH-PO-02).";

export const CONTROL_PROFILES: ControlProfileSeed[] = [
  {
    workForm: "CONVERSATIONAL",
    name: "Conversacional",
    label: "v1",
    dominantRisks: ["PRIVACY", "REPUTATIONAL", "REGULATORY"],
    decisionRole: "LEGAL",
    note: NOTE,
    controls: [
      {
        code: "CV-1",
        name: "Temas proibidos testados",
        category: "REPUTATIONAL",
        evidence: "Relatório da bateria de perguntas proibidas",
        acceptanceCriteria: "0 respostas fora da política na bateria.",
        role: "LEGAL",
        cadence: "QUARTERLY",
        minClass: "PUBLIC",
      },
      {
        code: "CV-2",
        name: "Auditoria de incorretas ≤ limite",
        category: "REPUTATIONAL",
        evidence: "Planilha amostral com data e auditor",
        acceptanceCriteria:
          "Taxa de incorretas na amostra menor ou igual ao limite do critério de vitória do piloto.",
        role: "COMPLIANCE",
        cadence: "WEEKLY",
        minClass: "PUBLIC",
      },
      {
        code: "CV-3",
        name: "Transbordo a humano funcionando",
        category: "OPERATIONAL",
        evidence: "Log de teste de ponta a ponta",
        acceptanceCriteria:
          "Teste ponta a ponta com o transbordo chegando a um humano no prazo definido.",
        role: "SECURITY",
        cadence: "MONTHLY",
        minClass: "INTERNAL",
      },
      {
        code: "CV-4",
        name: "RIPD aprovado",
        category: "PRIVACY",
        evidence: "RIPD assinado pelo DPO",
        acceptanceCriteria:
          "RIPD vigente com a assinatura do DPO. Obrigação legal, não dispensável.",
        role: "LEGAL",
        cadence: "ANNUAL",
        minClass: "CONFIDENTIAL",
        dispensable: false,
      },
    ],
  },
  {
    workForm: "ANALYSIS",
    name: "Análise",
    label: "v1",
    dominantRisks: ["BIAS", "REGULATORY", "OPERATIONAL"],
    decisionRole: "COMPLIANCE",
    note: NOTE,
    controls: [
      {
        code: "AN-1",
        name: "Erro por segmento ≤ 1,5× a média",
        category: "BIAS",
        evidence: "Relatório por segmento",
        acceptanceCriteria:
          "Nenhum segmento com erro acima de 1,5× a média (hipótese do Norte).",
        role: "COMPLIANCE",
        cadence: "QUARTERLY",
        minClass: "INTERNAL",
      },
      {
        code: "AN-2",
        name: "Explicabilidade ao titular (LGPD art. 20)",
        category: "REGULATORY",
        evidence: "Procedimento e amostra de explicações",
        acceptanceCriteria: `Procedimento vigente e amostra de explicações entregues. ${GERAL}`,
        role: "LEGAL",
        cadence: "ANNUAL",
        minClass: "CONFIDENTIAL",
      },
      {
        code: "AN-3",
        name: "Decisão final humana registrada",
        category: "OPERATIONAL",
        evidence: "Log com quem decidiu",
        acceptanceCriteria:
          "Toda decisão do período com o decisor humano identificado no log.",
        role: "COMPLIANCE",
        cadence: "MONTHLY",
        minClass: "PUBLIC",
      },
    ],
  },
  {
    workForm: "DOC_REVIEW",
    name: "Documentos",
    label: "v1",
    dominantRisks: ["PRIVACY", "SECURITY", "IP"],
    decisionRole: "SECURITY",
    note: NOTE,
    controls: [
      {
        code: "DR-1",
        name: "Documento só em fornecedor aprovado",
        category: "SECURITY",
        evidence: "Configuração e fornecedor aprovado no Charter",
        acceptanceCriteria:
          "Fluxo configurado apenas com fornecedor aprovado no Charter para a classe do dado.",
        role: "SECURITY",
        cadence: "ANNUAL",
        minClass: "CONFIDENTIAL",
      },
      {
        code: "DR-2",
        name: "Concordância amostral ≥ limiar",
        category: "OPERATIONAL",
        evidence: "Planilha de amostragem dupla",
        acceptanceCriteria:
          "Concordância na amostragem dupla maior ou igual ao limiar do critério de vitória do piloto.",
        role: "COMPLIANCE",
        cadence: "MONTHLY",
        minClass: "INTERNAL",
      },
      {
        code: "DR-3",
        name: "Retenção e descarte",
        category: "PRIVACY",
        evidence: "Política e log de descarte",
        acceptanceCriteria: `Política de retenção vigente e log de descarte do período. ${GERAL}`,
        role: "LEGAL",
        cadence: "ANNUAL",
        minClass: "CONFIDENTIAL",
      },
    ],
  },
  {
    workForm: "TRIAGE",
    name: "Triagem",
    label: "v1",
    dominantRisks: ["OPERATIONAL", "BIAS", "REGULATORY"],
    decisionRole: "COMPLIANCE",
    note: NOTE,
    controls: [
      {
        code: "TR-1",
        name: "Nenhum urgente rebaixado",
        category: "OPERATIONAL",
        evidence: "Planilha da amostra auditada",
        acceptanceCriteria:
          "Zero pedidos urgentes classificados como não urgentes na amostra auditada.",
        role: "COMPLIANCE",
        cadence: "MONTHLY",
        minClass: "PUBLIC",
      },
      {
        code: "TR-2",
        name: "Rollback testado",
        category: "OPERATIONAL",
        evidence: "Registro de execução em produção",
        acceptanceCriteria:
          "Rollback executado em produção ao menos uma vez, com registro. É a mesma evidência do B2.1 do Scaffold.",
        role: "SECURITY",
        cadence: "SEMIANNUAL",
        minClass: "PUBLIC",
      },
      {
        code: "TR-3",
        name: "Casos sempre-humano respeitados",
        category: "BIAS",
        evidence: "Log de roteamento",
        acceptanceCriteria:
          "Todo caso da lista sempre-humano roteado a uma pessoa no período.",
        role: "COMPLIANCE",
        cadence: "MONTHLY",
        minClass: "INTERNAL",
      },
    ],
  },
  {
    workForm: "REPORTING",
    name: "Relatórios",
    label: "v1",
    dominantRisks: ["REGULATORY", "REPUTATIONAL", "OPERATIONAL"],
    decisionRole: "COMPLIANCE",
    note: NOTE,
    controls: [
      {
        code: "RP-1",
        name: "Revisão humana antes de sair",
        category: "REPUTATIONAL",
        evidence: "Checklist assinado por ciclo",
        acceptanceCriteria: "Checklist assinado para cada ciclo emitido.",
        role: "COMPLIANCE",
        cadence: "PER_CYCLE",
        minClass: "PUBLIC",
      },
      {
        code: "RP-2",
        name: "Reconciliação sem divergência não explicada",
        category: "REGULATORY",
        evidence: "Planilha de reconciliação",
        acceptanceCriteria:
          "Reconciliação do ciclo fecha sem divergência não explicada.",
        role: "COMPLIANCE",
        cadence: "PER_CYCLE",
        minClass: "INTERNAL",
      },
      {
        code: "RP-3",
        name: "Número rastreável à fonte",
        category: "REGULATORY",
        evidence: "Mapa fonte → campo",
        acceptanceCriteria: `Cada número do relatório mapeado à sua fonte. ${GERAL}`,
        role: "COMPLIANCE",
        cadence: "QUARTERLY",
        minClass: "INTERNAL",
      },
    ],
  },
];
