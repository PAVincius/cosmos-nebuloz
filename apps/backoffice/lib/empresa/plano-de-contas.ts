/**
 * Regras do plano de contas. A lista das 27 contas mora no banco
 * (ContaDoPlano, semeada de packages/provisioning/src/plano-de-contas-nebuloz.ts)
 * desde 6 set — a operação abre conta sem deploy. Aqui fica só o que é regra.
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
  ativa: boolean;
};

/** As seis parcelas do CAC que são contas do DRE (cac-modelo.md §2). Fixas:
 *  são o vínculo com o modelo de CAC, não o plano. */
export const CONTAS_DO_CAC = [
  "4.1",
  "4.2",
  "4.3",
  "4.4",
  "4.5",
  "4.6",
] as const;
export type ContaDoCac = (typeof CONTAS_DO_CAC)[number];

const FORMATO = /^[1-6]\.\d{1,2}$/;

export function contaValida(codigo: string): boolean {
  return FORMATO.test(codigo);
}

export function grupoDoCodigo(codigo: string): Grupo | null {
  return contaValida(codigo) ? (Number(codigo[0]) as Grupo) : null;
}

export function centroDoGrupo(grupo: Grupo): CentroDeCusto | null {
  switch (grupo) {
    case 3:
      return "entrega";
    case 4:
      return "comercial";
    case 5:
      return "produto-engenharia";
    case 6:
      return "ga";
    default:
      return null;
  }
}

export const ROTULO_CENTRO: Record<CentroDeCusto, string> = {
  comercial: "Comercial",
  "produto-engenharia": "Produto e engenharia",
  entrega: "Entrega",
  ga: "G&A",
};
