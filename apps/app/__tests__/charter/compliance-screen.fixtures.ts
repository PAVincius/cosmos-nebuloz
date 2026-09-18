/** Fixtures da tela de conformidade — compartilhadas pelos testes de tela. */
import type {
  ComplianceMap,
  MapRow,
  SetRow,
} from "@/app/(charter)/actions/compliance";

export const set = (over: Partial<SetRow> = {}): SetRow => ({
  id: "set-1",
  nome: "RFP Banco Aurora",
  origem: "RFP",
  global: false,
  versao: "1",
  total: 1,
  supersedesId: null,
  supersededById: null,
  temCobertura: false,
  diff: null,
  normaStatus: "VIGENTE",
  vigenciaEm: null,
  vigenciaPropostaEm: null,
  ...over,
});

/** RFP sem data: obriga desde já. É o padrão do domínio, e por isso é o padrão
 *  da fixture — teste que não fala de vigência não deveria ter de declará-la. */
export const vigenciaPadrao: MapRow["vigencia"] = {
  status: "VIGENTE",
  em: null,
  obriga: true,
  motivo: null,
  nota: null,
  herdada: true,
};

export const row = (over: Partial<MapRow> = {}): MapRow => ({
  requirementId: "req-1",
  codigo: "4.2.1",
  citacao: "RFP §4.2.1",
  resumo: "Aceite individual de política deve ser rastreável por pessoa",
  peso: null,
  status: "SEM_VEREDITO",
  comentario: null,
  capabilityId: null,
  capabilityLabel: null,
  evidencia: null,
  evidenciaErro: null,
  vigencia: vigenciaPadrao,
  ...over,
});

export const map = (over: Partial<ComplianceMap> = {}): ComplianceMap => ({
  setId: "set-1",
  nome: "RFP Banco Aurora",
  cenario: "EM_VIGOR",
  referencia: "2026-08-08T00:00:00.000Z",
  semVeredito: 0,
  semVereditoQueObriga: 0,
  divergentes: 0,
  linhas: [],
  ...over,
});
