/**
 * Regras puras do livro-razão e de títulos a pagar/receber (dre-modelo.md,
 * livro-razao-e-titulos.md). Sem Prisma, sem I/O: `agregarPorMes` alimenta
 * `calcularDre` de ./financeiro, e o contrato entre as duas é o mesmo nulo —
 * conta sem lançamento no mês fica ausente da chave, nunca zerada.
 */

import type { Tone } from "@repo/design-system/cosmos/kit";
import type { LancamentosDoMes } from "./financeiro";

export type LinhaDoLivro = {
  id: string;
  competencia: string;
  /** ISO "AAAA-MM-DD". */
  data: string;
  conta: string;
  descricao: string;
  valorCentavos: number;
  contraparte: string | null;
  documento: string | null;
  nota: string | null;
  tituloId: string | null;
};

export type TituloRow = {
  id: string;
  tipo: "PAGAR" | "RECEBER";
  descricao: string;
  contraparte: string;
  conta: string;
  valorCentavos: number;
  emissao: string;
  vencimento: string;
  status: "ABERTO" | "BAIXADO" | "CANCELADO";
  baixadoEm: string | null;
  competenciaBaixa: string | null;
  motivoCancelamento: string | null;
  clienteSlug: string | null;
};

export type Situacao = "ABERTO" | "VENCIDO" | "BAIXADO" | "CANCELADO";
export type FaixaDeVencimento = {
  id: "a-vencer" | "1-30" | "31-60" | "61-90" | "90-mais";
  rotulo: string;
  valorCentavos: number;
  quantidade: number;
};

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ABERTO: "Aberto",
  VENCIDO: "Vencido",
  BAIXADO: "Baixado",
  CANCELADO: "Cancelado",
};

export const TOM_SITUACAO: Record<Situacao, Tone> = {
  ABERTO: "blue",
  VENCIDO: "red",
  BAIXADO: "green",
  CANCELADO: "neutral",
};

export const ROTULO_TIPO: Record<TituloRow["tipo"], string> = {
  PAGAR: "A pagar",
  RECEBER: "A receber",
};

/** Agrega linhas do livro por competência e conta, somando valores. Nunca
 * inicializa uma conta com zero: conta sem lançamento no mês fica ausente da
 * chave — é o nulo que `calcularDre` espera para não mentir com "o que tem". */
export function agregarPorMes(
  linhas: Pick<LinhaDoLivro, "competencia" | "conta" | "valorCentavos">[]
): Record<string, LancamentosDoMes> {
  const porMes: Record<string, LancamentosDoMes> = {};
  for (const l of linhas) {
    if (!porMes[l.competencia]) {
      porMes[l.competencia] = {};
    }
    const mes = porMes[l.competencia];
    mes[l.conta] = (mes[l.conta] ?? 0) + l.valorCentavos;
  }
  return porMes;
}

/** Soma por conta, ignorando competência. */
export function totalPorConta(
  linhas: Pick<LinhaDoLivro, "conta" | "valorCentavos">[]
): Record<string, number> {
  const porConta: Record<string, number> = {};
  for (const l of linhas) {
    porConta[l.conta] = (porConta[l.conta] ?? 0) + l.valorCentavos;
  }
  return porConta;
}

/** Trunca para meia-noite UTC — mesma ideia de lib/comercial/funil.ts:
 * a fronteira do dia é a mesma em qualquer horário, não uma divisão de
 * milissegundos que erra por fuso. */
const meiaNoiteUtcMs = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Datas de título/livro são ISO "AAAA-MM-DD": parseadas como UTC explícito
 * (`T00:00:00Z`), nunca com `new Date(s)` puro — alguns engines tratam esse
 * formato como horário local. */
function paraDataUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Dias inteiros entre duas datas, por fronteira de dia UTC (floor). */
function diasEntre(a: Date, b: Date): number {
  return Math.floor((meiaNoiteUtcMs(b) - meiaNoiteUtcMs(a)) / DIA_MS);
}

/** Situação é derivada na leitura: BAIXADO e CANCELADO passam direto; ABERTO
 * vira VENCIDO quando o vencimento (dia UTC) já passou — vencer hoje ainda
 * não é vencido. */
export function situacaoDoTitulo(t: TituloRow, hoje: Date): Situacao {
  if (t.status !== "ABERTO") {
    return t.status;
  }
  const diasDeAtraso = diasEntre(paraDataUtc(t.vencimento), hoje);
  return diasDeAtraso > 0 ? "VENCIDO" : "ABERTO";
}

const FAIXAS_DEF: { id: FaixaDeVencimento["id"]; rotulo: string }[] = [
  { id: "a-vencer", rotulo: "A vencer" },
  { id: "1-30", rotulo: "1 a 30 dias" },
  { id: "31-60", rotulo: "31 a 60 dias" },
  { id: "61-90", rotulo: "61 a 90 dias" },
  { id: "90-mais", rotulo: "Mais de 90 dias" },
];

/** Faixa de atraso (em dias, negativo = ainda a vencer) para uma das cinco
 * faixas fixas de envelhecimento. */
function faixaDoAtraso(diasDeAtraso: number): FaixaDeVencimento["id"] {
  if (diasDeAtraso <= 0) {
    return "a-vencer";
  }
  if (diasDeAtraso <= 30) {
    return "1-30";
  }
  if (diasDeAtraso <= 60) {
    return "31-60";
  }
  if (diasDeAtraso <= 90) {
    return "61-90";
  }
  return "90-mais";
}

/** Só títulos ABERTO entram — BAIXADO e CANCELADO já resolveram. Devolve
 * sempre as cinco faixas, na ordem, mesmo zeradas. */
export function envelhecimento(
  titulos: TituloRow[],
  hoje: Date
): FaixaDeVencimento[] {
  const porFaixa = new Map<
    FaixaDeVencimento["id"],
    { valorCentavos: number; quantidade: number }
  >(FAIXAS_DEF.map((f) => [f.id, { valorCentavos: 0, quantidade: 0 }]));

  for (const t of titulos) {
    if (t.status !== "ABERTO") {
      continue;
    }
    const diasDeAtraso = diasEntre(paraDataUtc(t.vencimento), hoje);
    const faixa = porFaixa.get(faixaDoAtraso(diasDeAtraso));
    if (faixa) {
      faixa.valorCentavos += t.valorCentavos;
      faixa.quantidade += 1;
    }
  }

  return FAIXAS_DEF.map((f) => ({
    id: f.id,
    rotulo: f.rotulo,
    ...(porFaixa.get(f.id) ?? { valorCentavos: 0, quantidade: 0 }),
  }));
}
