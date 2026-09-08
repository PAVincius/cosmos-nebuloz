// Plano de contas da Nebuloz — docs/financeiro/plano-de-contas.md. Veio de
// PLANO_DE_CONTAS em apps/backoffice/lib/empresa/plano-de-contas.ts (6 set
// 2026, quando a constante virou tabela `ContaDoPlano`). Consumido por
// apps/app/scripts/seed-empresa-nebuloz.ts.
//
// Só dados e tipos: sem import de valor de "@repo/database" (server-only).

export type Grupo = 1 | 2 | 3 | 4 | 5 | 6;

export type CentroDeCusto =
  | "comercial"
  | "produto-engenharia"
  | "entrega"
  | "ga";

export type ContaSeed = {
  conta: string;
  nome: string;
  grupo: Grupo;
  centroDeCusto: CentroDeCusto | null;
  ordem: number;
};

export const PLANO_DE_CONTAS_NEBULOZ: ContaSeed[] = [
  // 1 — Receita
  {
    conta: "1.1",
    nome: "Receita de assinatura — Meridian",
    grupo: 1,
    centroDeCusto: null,
    ordem: 0,
  },
  {
    conta: "1.2",
    nome: "Receita de assinatura — Charter",
    grupo: 1,
    centroDeCusto: null,
    ordem: 1,
  },
  {
    conta: "1.3",
    nome: "Receita de assinatura — Cosmos",
    grupo: 1,
    centroDeCusto: null,
    ordem: 2,
  },
  {
    conta: "1.4",
    nome: "Receita de assinatura — Signal",
    grupo: 1,
    centroDeCusto: null,
    ordem: 3,
  },
  {
    conta: "1.5",
    nome: "Receita de serviço — Meridian (diagnóstico)",
    grupo: 1,
    centroDeCusto: null,
    ordem: 4,
  },
  {
    conta: "1.6",
    nome: "Receita de serviço — Scaffold",
    grupo: 1,
    centroDeCusto: null,
    ordem: 5,
  },
  {
    conta: "1.7",
    nome: "Receita de serviço — Charter (setup)",
    grupo: 1,
    centroDeCusto: null,
    ordem: 6,
  },
  {
    conta: "1.8",
    nome: "Receita de outros serviços",
    grupo: 1,
    centroDeCusto: null,
    ordem: 7,
  },
  // 2 — Deduções
  {
    conta: "2.1",
    nome: "Impostos sobre serviço/receita",
    grupo: 2,
    centroDeCusto: null,
    ordem: 8,
  },
  {
    conta: "2.2",
    nome: "Cancelamentos e estornos",
    grupo: 2,
    centroDeCusto: null,
    ordem: 9,
  },
  // 3 — Custo de entrega
  {
    conta: "3.1",
    nome: "Pessoal de entrega — Meridian",
    grupo: 3,
    centroDeCusto: "entrega",
    ordem: 10,
  },
  {
    conta: "3.2",
    nome: "Pessoal de entrega — Scaffold",
    grupo: 3,
    centroDeCusto: "entrega",
    ordem: 11,
  },
  {
    conta: "3.3",
    nome: "Pessoal de entrega — Charter/outros",
    grupo: 3,
    centroDeCusto: "entrega",
    ordem: 12,
  },
  {
    conta: "3.4",
    nome: "Terceiros e subcontratados de entrega",
    grupo: 3,
    centroDeCusto: "entrega",
    ordem: 13,
  },
  {
    conta: "3.5",
    nome: "Ferramentas de entrega",
    grupo: 3,
    centroDeCusto: "entrega",
    ordem: 14,
  },
  // 4 — Comercial (as contas que o CAC lê)
  {
    conta: "4.1",
    nome: "Pessoal de vendas",
    grupo: 4,
    centroDeCusto: "comercial",
    ordem: 15,
  },
  {
    conta: "4.2",
    nome: "Pessoal de marketing",
    grupo: 4,
    centroDeCusto: "comercial",
    ordem: 16,
  },
  {
    conta: "4.3",
    nome: "Comissões",
    grupo: 4,
    centroDeCusto: "comercial",
    ordem: 17,
  },
  {
    conta: "4.4",
    nome: "Ferramentas de vendas e marketing",
    grupo: 4,
    centroDeCusto: "comercial",
    ordem: 18,
  },
  {
    conta: "4.5",
    nome: "Mídia paga",
    grupo: 4,
    centroDeCusto: "comercial",
    ordem: 19,
  },
  {
    conta: "4.6",
    nome: "Discovery não faturado",
    grupo: 4,
    centroDeCusto: "comercial",
    ordem: 20,
  },
  // 5 — Produto/engenharia
  {
    conta: "5.1",
    nome: "Pessoal de engenharia e produto",
    grupo: 5,
    centroDeCusto: "produto-engenharia",
    ordem: 21,
  },
  {
    conta: "5.2",
    nome: "Infraestrutura",
    grupo: 5,
    centroDeCusto: "produto-engenharia",
    ordem: 22,
  },
  {
    conta: "5.3",
    nome: "Ferramentas de engenharia",
    grupo: 5,
    centroDeCusto: "produto-engenharia",
    ordem: 23,
  },
  // 6 — G&A
  {
    conta: "6.1",
    nome: "Pessoal de liderança e administrativo",
    grupo: 6,
    centroDeCusto: "ga",
    ordem: 24,
  },
  {
    conta: "6.2",
    nome: "Jurídico e contábil",
    grupo: 6,
    centroDeCusto: "ga",
    ordem: 25,
  },
  {
    conta: "6.3",
    nome: "Escritório e outras despesas",
    grupo: 6,
    centroDeCusto: "ga",
    ordem: 26,
  },
];
