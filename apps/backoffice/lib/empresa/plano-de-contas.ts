/**
 * Plano de contas da Nebuloz — docs/financeiro/plano-de-contas.md, em código.
 *
 * Em constante e não em tabela: conta nova é uma linha aqui e um commit, e o
 * DRE precisa saber a que grupo cada conta pertence para somar. Uma tabela
 * obrigaria a semear e a validar contra o banco o que o documento já fixa.
 */

export type Grupo = 1 | 2 | 3 | 4 | 5 | 6;

export type CentroDeCusto =
  | "comercial"
  | "produto-engenharia"
  | "entrega"
  | "ga";

export type Conta = {
  conta: string;
  nome: string;
  grupo: Grupo;
  centroDeCusto: CentroDeCusto | null;
};

export const PLANO_DE_CONTAS: readonly Conta[] = [
  // 1 — Receita
  {
    conta: "1.1",
    nome: "Receita de assinatura — Meridian",
    grupo: 1,
    centroDeCusto: null,
  },
  {
    conta: "1.2",
    nome: "Receita de assinatura — Charter",
    grupo: 1,
    centroDeCusto: null,
  },
  {
    conta: "1.3",
    nome: "Receita de assinatura — Cosmos",
    grupo: 1,
    centroDeCusto: null,
  },
  {
    conta: "1.4",
    nome: "Receita de assinatura — Signal",
    grupo: 1,
    centroDeCusto: null,
  },
  {
    conta: "1.5",
    nome: "Receita de serviço — Meridian (diagnóstico)",
    grupo: 1,
    centroDeCusto: null,
  },
  {
    conta: "1.6",
    nome: "Receita de serviço — Scaffold",
    grupo: 1,
    centroDeCusto: null,
  },
  {
    conta: "1.7",
    nome: "Receita de serviço — Charter (setup)",
    grupo: 1,
    centroDeCusto: null,
  },
  {
    conta: "1.8",
    nome: "Receita de outros serviços",
    grupo: 1,
    centroDeCusto: null,
  },
  // 2 — Deduções
  {
    conta: "2.1",
    nome: "Impostos sobre serviço/receita",
    grupo: 2,
    centroDeCusto: null,
  },
  {
    conta: "2.2",
    nome: "Cancelamentos e estornos",
    grupo: 2,
    centroDeCusto: null,
  },
  // 3 — Custo de entrega
  {
    conta: "3.1",
    nome: "Pessoal de entrega — Meridian",
    grupo: 3,
    centroDeCusto: "entrega",
  },
  {
    conta: "3.2",
    nome: "Pessoal de entrega — Scaffold",
    grupo: 3,
    centroDeCusto: "entrega",
  },
  {
    conta: "3.3",
    nome: "Pessoal de entrega — Charter/outros",
    grupo: 3,
    centroDeCusto: "entrega",
  },
  {
    conta: "3.4",
    nome: "Terceiros e subcontratados de entrega",
    grupo: 3,
    centroDeCusto: "entrega",
  },
  {
    conta: "3.5",
    nome: "Ferramentas de entrega",
    grupo: 3,
    centroDeCusto: "entrega",
  },
  // 4 — Comercial (as contas que o CAC lê)
  {
    conta: "4.1",
    nome: "Pessoal de vendas",
    grupo: 4,
    centroDeCusto: "comercial",
  },
  {
    conta: "4.2",
    nome: "Pessoal de marketing",
    grupo: 4,
    centroDeCusto: "comercial",
  },
  {
    conta: "4.3",
    nome: "Comissões",
    grupo: 4,
    centroDeCusto: "comercial",
  },
  {
    conta: "4.4",
    nome: "Ferramentas de vendas e marketing",
    grupo: 4,
    centroDeCusto: "comercial",
  },
  {
    conta: "4.5",
    nome: "Mídia paga",
    grupo: 4,
    centroDeCusto: "comercial",
  },
  {
    conta: "4.6",
    nome: "Discovery não faturado",
    grupo: 4,
    centroDeCusto: "comercial",
  },
  // 5 — Produto/engenharia
  {
    conta: "5.1",
    nome: "Pessoal de engenharia e produto",
    grupo: 5,
    centroDeCusto: "produto-engenharia",
  },
  {
    conta: "5.2",
    nome: "Infraestrutura",
    grupo: 5,
    centroDeCusto: "produto-engenharia",
  },
  {
    conta: "5.3",
    nome: "Ferramentas de engenharia",
    grupo: 5,
    centroDeCusto: "produto-engenharia",
  },
  // 6 — G&A
  {
    conta: "6.1",
    nome: "Pessoal de liderança e administrativo",
    grupo: 6,
    centroDeCusto: "ga",
  },
  {
    conta: "6.2",
    nome: "Jurídico e contábil",
    grupo: 6,
    centroDeCusto: "ga",
  },
  {
    conta: "6.3",
    nome: "Escritório e outras despesas",
    grupo: 6,
    centroDeCusto: "ga",
  },
];

export const CONTAS_DO_CAC = [
  "4.1",
  "4.2",
  "4.3",
  "4.4",
  "4.5",
  "4.6",
] as const;
export type ContaDoCac = (typeof CONTAS_DO_CAC)[number];

const CODIGOS = new Set(PLANO_DE_CONTAS.map((c) => c.conta));

export function contaValida(codigo: string): boolean {
  return CODIGOS.has(codigo);
}

export function contasDoGrupo(grupo: Grupo): string[] {
  return PLANO_DE_CONTAS.filter((c) => c.grupo === grupo).map((c) => c.conta);
}

/** Linha agregada do DRE: um rótulo e as contas que soma (dre-modelo.md). */
export type LinhaDre = { id: string; rotulo: string; contas: string[] };

export const LINHAS_RECEITA: readonly LinhaDre[] = [
  {
    id: "assin-meridian",
    rotulo: "Receita de assinatura — Meridian",
    contas: ["1.1"],
  },
  {
    id: "assin-charter",
    rotulo: "Receita de assinatura — Charter",
    contas: ["1.2"],
  },
  {
    id: "assin-cosmos",
    rotulo: "Receita de assinatura — Cosmos",
    contas: ["1.3"],
  },
  {
    id: "assin-signal",
    rotulo: "Receita de assinatura — Signal",
    contas: ["1.4"],
  },
  {
    id: "serv-meridian",
    rotulo: "Receita de serviço — Meridian",
    contas: ["1.5"],
  },
  {
    id: "serv-scaffold",
    rotulo: "Receita de serviço — Scaffold",
    contas: ["1.6"],
  },
  {
    id: "serv-outros",
    rotulo: "Receita de serviço — Charter e outros",
    contas: ["1.7", "1.8"],
  },
];

export const LINHAS_CUSTO: readonly LinhaDre[] = [
  {
    id: "custo-meridian",
    rotulo: "Custo de entrega — Meridian",
    contas: ["3.1"],
  },
  {
    id: "custo-scaffold",
    rotulo: "Custo de entrega — Scaffold",
    contas: ["3.2"],
  },
  {
    id: "custo-outros",
    rotulo: "Custo de entrega — Charter e outros",
    contas: ["3.3", "3.4", "3.5"],
  },
];

export const LINHAS_DESPESA: readonly LinhaDre[] = [
  { id: "comercial", rotulo: "Comercial", contas: [...CONTAS_DO_CAC] },
  {
    id: "produto",
    rotulo: "Produto e engenharia",
    contas: ["5.1", "5.2", "5.3"],
  },
  { id: "ga", rotulo: "G&A", contas: ["6.1", "6.2", "6.3"] },
];
