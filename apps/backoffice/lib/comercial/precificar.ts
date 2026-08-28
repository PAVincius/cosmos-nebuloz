/**
 * A fórmula comercial da Nebuloz, isolada de tudo.
 *
 * Sem Prisma, sem React, sem I/O: só entrada e saída. É o que permite a mesma
 * conta rodar no preview que o cliente lê durante a call, no ACV do pipeline e
 * na validação do servidor no envio — três lugares que não podem discordar
 * sobre quanto custa.
 *
 * Referência: design_handoff_bigbang/DATA-MODEL.md §3.1.
 */

/** Como o serviço é cobrado. Só `RETAINER` recorre — é o que a fórmula lê. */
export type UnidadeDeCobranca = "PROJETO" | "SPRINT" | "HORA" | "RETAINER";

export type CatalogoParaPreco = {
  plano: { precoAssentoCentavos: number; minimoAssentos: number };
  modulos: { moduloId: string; precoMensalCentavos: number }[];
  termo: { meses: number; descontoPercent: number };
  addOns: { precoCentavos: number; recorrente: boolean }[];
  servicos: { precoCentavos: number; unidade: UnidadeDeCobranca }[];
};

export type Escopo = {
  assentos: number;
  /** Desconto comercial negociado, 0 a 100. */
  descontoPercent: number;
};

export type Preco = {
  assentosFaturados: number;
  /** Verdadeiro quando o pedido ficou abaixo do mínimo do plano. A tela diz. */
  minimoAplicado: boolean;
  assentosCentavos: number;
  modulosCentavos: number;
  addOnsRecorrentesCentavos: number;
  servicosRecorrentesCentavos: number;
  brutoMensalCentavos: number;
  descontoDePrazoCentavos: number;
  descontoComercialCentavos: number;
  liquidoMensalCentavos: number;
  /** Setup e serviços de projeto — fora da mensalidade e fora do desconto. */
  umaVezCentavos: number;
  acvCentavos: number;
  tcvCentavos: number;
  meses: number;
};

const soma = (valores: number[]): number => valores.reduce((a, b) => a + b, 0);

export function precificarProposta(
  catalogo: CatalogoParaPreco,
  escopo: Escopo
): Preco {
  const assentosFaturados = Math.max(
    escopo.assentos,
    catalogo.plano.minimoAssentos
  );
  const assentosCentavos =
    assentosFaturados * catalogo.plano.precoAssentoCentavos;

  const modulosCentavos = soma(
    catalogo.modulos.map((m) => m.precoMensalCentavos)
  );

  const addOnsRecorrentesCentavos = soma(
    catalogo.addOns.filter((a) => a.recorrente).map((a) => a.precoCentavos)
  );
  const addOnsUmaVezCentavos = soma(
    catalogo.addOns.filter((a) => !a.recorrente).map((a) => a.precoCentavos)
  );

  const servicosRecorrentesCentavos = soma(
    catalogo.servicos
      .filter((s) => s.unidade === "RETAINER")
      .map((s) => s.precoCentavos)
  );
  const servicosUmaVezCentavos = soma(
    catalogo.servicos
      .filter((s) => s.unidade !== "RETAINER")
      .map((s) => s.precoCentavos)
  );

  const brutoMensalCentavos =
    assentosCentavos +
    modulosCentavos +
    addOnsRecorrentesCentavos +
    servicosRecorrentesCentavos;

  // Prazo primeiro, comercial depois, sobre o já descontado — a ordem é
  // normativa no spec, e invertê-la muda o total e a comissão.
  //
  // Arredonda a cada etapa, não só no fim: cada etapa é uma linha que o cliente
  // lê no documento, e linha que não fecha com o total vira disputa. Por isso o
  // teste "as linhas de desconto reconstroem o líquido".
  const aposPrazo = Math.round(
    brutoMensalCentavos * (1 - catalogo.termo.descontoPercent / 100)
  );
  const liquidoMensalCentavos = Math.round(
    aposPrazo * (1 - escopo.descontoPercent / 100)
  );

  // Setup fica fora do desconto: negociar preço de serviço de projeto é outra
  // conversa, e no documento é outra seção.
  const umaVezCentavos = addOnsUmaVezCentavos + servicosUmaVezCentavos;

  return {
    assentosFaturados,
    minimoAplicado: escopo.assentos < catalogo.plano.minimoAssentos,
    assentosCentavos,
    modulosCentavos,
    addOnsRecorrentesCentavos,
    servicosRecorrentesCentavos,
    brutoMensalCentavos,
    descontoDePrazoCentavos: brutoMensalCentavos - aposPrazo,
    descontoComercialCentavos: aposPrazo - liquidoMensalCentavos,
    liquidoMensalCentavos,
    umaVezCentavos,
    acvCentavos: liquidoMensalCentavos * 12,
    tcvCentavos: liquidoMensalCentavos * catalogo.termo.meses + umaVezCentavos,
    meses: catalogo.termo.meses,
  };
}
