/**
 * Regras puras do funil v2 (spec §1-2, design backoffice-funnel.jsx e
 * backoffice-funnel-stage.jsx).
 *
 * Sem Prisma, sem React, sem I/O: é a mesma conta que sustenta o pipeline
 * ponderado do board, o painel do estágio e a validação das actions — três
 * lugares que não podem discordar sobre peso, teto e situação de um lead.
 *
 * Referência: docs/superpowers/specs/2026-09-06-funil-v2-design.md.
 */
import type { ProductModule } from "@repo/database";
import type { Tone } from "@repo/design-system/cosmos/kit";

export const ESTAGIOS = [
  "LEAD",
  "DISCOVERY",
  "EVALUATION",
  "PROPOSAL",
] as const;
export type Estagio = (typeof ESTAGIOS)[number];

/** Os três estágios que aceitam arrastar entre si. PROPOSAL só via conversão. */
export const ABERTOS = ["LEAD", "DISCOVERY", "EVALUATION"] as const;
/** Subtipo de `Estagio` que aceita mover pelo board — os três de `ABERTOS`. */
export type EstagioAberto = (typeof ABERTOS)[number];

export const INFO_ESTAGIO: Record<
  Estagio,
  { rotulo: string; curto: string; descricao: string; tom: Tone }
> = {
  LEAD: {
    rotulo: "Lead",
    curto: "Lead",
    descricao: "Contato existe. Ninguém falou com ele ainda.",
    tom: "neutral",
  },
  DISCOVERY: {
    rotulo: "Descoberta",
    curto: "Desc.",
    descricao: "Primeira conversa feita. Problema e sponsor identificados.",
    tom: "blue",
  },
  EVALUATION: {
    rotulo: "Avaliação",
    curto: "Aval.",
    descricao: "Escopo e produto de entrada acordados. Falta preço.",
    tom: "accent",
  },
  PROPOSAL: {
    rotulo: "Proposta",
    curto: "Prop.",
    descricao: "Proposta emitida. O funil lê o status dela.",
    tom: "amber",
  },
};

/** "neutral" (LEAD) não tem variável de cor própria no kit — cai no azul. Um
 *  mapeamento só: board, stepper do lead e critérios de saída do painel liam
 *  isso cada um a seu jeito (duas cópias, e o board nem tinha a correção —
 *  emitia `var(--neutral)`, que não existe). */
export function tomCssDoEstagio(tom: Tone): Tone {
  return tom === "neutral" ? "blue" : tom;
}

export const MOTIVOS_PERDA = {
  PRECO: "Preço",
  TIMING: "Timing / orçamento adiado",
  SEM_SPONSOR: "Sem sponsor executivo",
  CONCORRENTE: "Concorrente ou solução interna",
  SEM_FIT: "Sem fit com o método",
  OUTRO: "Outro",
} as const;
export type MotivoPerda = keyof typeof MOTIVOS_PERDA;

/** Porta de entrada na Escada. O CTA é sempre o assessment (degrau 01). */
export const PORTAS: Record<
  ProductModule,
  { degrau: string; rotulo: string; dica: string }
> = {
  MERIDIAN: { degrau: "01", rotulo: "Meridian", dica: "Assessment" },
  SCAFFOLD: { degrau: "02", rotulo: "Scaffold", dica: "Trilhas" },
  SIGNAL: { degrau: "03", rotulo: "Signal", dica: "Medição" },
  CHARTER: { degrau: "04", rotulo: "Charter", dica: "Governança" },
  COSMOS: { degrau: "05", rotulo: "Cosmos", dica: "Operação" },
};

export type ConfigEstagio = {
  codigo: Estagio;
  pesoPercent: number;
  tetoDias: number;
  criterios: string[];
};

export type LeadFunil = {
  id: string;
  estagio: string;
  estagioDesde: string;
  situacao: "ATIVO" | "GANHO" | "PERDIDO";
  acvEstimadoCentavos: number | null;
  proposta: { acvCentavos: number; status: string } | null;
  entrada: string | null;
  canalSlug: string | null;
  perdidoNoEstagio: string | null;
};

/** Forma estrutural que `paraLeadFunil` precisa de um lead lido do servidor —
 *  não importa `LeadRow` de `app/actions/leads`: esta lib fica pura (sem
 *  Prisma, sem I/O), e `LeadRow` satisfaz este tipo sem precisar de conversão
 *  explícita nos cinco lugares que chamam a função. */
export type LeadParaConversao = Omit<LeadFunil, "canalSlug"> & {
  canal: { slug: string } | null;
};

/** `LeadRow` (leitura do servidor) → `LeadFunil` (regras puras). Era
 *  reimplementada idêntica em page.tsx, funil.tsx, board.tsx, tabela-leads.tsx
 *  e lead-dialog.tsx — cinco cópias que só podiam divergir por descuido.
 *  Centralizada aqui porque `canalSlug: l.canal?.slug ?? null` é a única
 *  regra que importa, e ela não muda entre apresentações. */
export function paraLeadFunil(l: LeadParaConversao): LeadFunil {
  return {
    id: l.id,
    estagio: l.estagio,
    estagioDesde: l.estagioDesde,
    situacao: l.situacao,
    acvEstimadoCentavos: l.acvEstimadoCentavos,
    proposta: l.proposta,
    entrada: l.entrada,
    canalSlug: l.canal?.slug ?? null,
    perdidoNoEstagio: l.perdidoNoEstagio,
  };
}

/** Forma estrutural que `textoEntradaOrigem` precisa — mesma ideia de
 *  `LeadParaConversao`: `LeadRow` satisfaz isto sem conversão explícita. */
export type LeadOrigemInfo = {
  entrada: string | null;
  canal: { nome: string } | null;
  origem: string | null;
};

/** "01 Meridian · Indicação" — era reimplementada idêntica em board.tsx
 *  (`textoOrigem`) e tabela-leads.tsx (`textoEntradaOrigem`). */
export function textoEntradaOrigem(l: LeadOrigemInfo): string {
  const porta = l.entrada ? PORTAS[l.entrada as ProductModule] : undefined;
  const entradaTexto = porta ? `${porta.degrau} ${porta.rotulo}` : "—";
  const canalTexto = l.canal?.nome ?? l.origem ?? "—";
  return `${entradaTexto} · ${canalTexto}`;
}

/** Rótulo de "sem passo" — três grafias diferentes em board.tsx,
 *  estagio-dialog-partes.tsx e tabela-leads.tsx viraram uma. */
export const SEM_PROXIMO_PASSO = "Sem próximo passo";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Trunca para meia-noite UTC — é o que faz a fronteira do dia ser a mesma em
 * qualquer horário, não uma divisão de milissegundos que erra por fuso. */
const meiaNoiteUtcMs = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Dias inteiros entre duas datas, por fronteira de dia UTC (floor) — mesma
 *  truncagem para `diasNoEstagio` e para a janela/permanência de
 *  `metricasDoEstagio`: 23h de um dia para 1h do seguinte são dias UTC
 *  diferentes, logo 1 dia, não 0 (2h brutas arredondaria para baixo). */
function diasEntre(a: Date, b: Date): number {
  return Math.floor((meiaNoiteUtcMs(b) - meiaNoiteUtcMs(a)) / DIA_MS);
}

/** Situação é derivada na leitura, nunca gravada (spec §1.1). */
export function situacaoDe(
  perdidoEm: string | null,
  propostaStatus: string | null
): "ATIVO" | "GANHO" | "PERDIDO" {
  if (propostaStatus === "ACEITA") {
    return "GANHO";
  }
  if (perdidoEm !== null || propostaStatus === "RECUSADA") {
    return "PERDIDO";
  }
  return "ATIVO";
}

/** Dias inteiros entre estagioDesde e hoje, por fronteira de dia UTC (floor). */
export function diasNoEstagio(estagioDesde: string, hoje: Date): number {
  return diasEntre(new Date(estagioDesde), hoje);
}

export function estagnado(
  l: LeadFunil,
  cfg: ConfigEstagio[],
  hoje: Date
): boolean {
  if (l.situacao !== "ATIVO") {
    return false;
  }
  const c = cfg.find((cc) => cc.codigo === l.estagio);
  if (!c) {
    return false;
  }
  return diasNoEstagio(l.estagioDesde, hoje) > c.tetoDias;
}

/** Valor do lead: ACV da proposta quando existe, senão a estimativa — uma
 * verdade só (spec §1.1). */
export function valorDoLead(l: LeadFunil): number {
  if (l.proposta) {
    return l.proposta.acvCentavos;
  }
  return l.acvEstimadoCentavos ?? 0;
}

export function pipelinePonderado(
  leads: LeadFunil[],
  cfg: ConfigEstagio[]
): number {
  return leads
    .filter((l) => l.situacao === "ATIVO")
    .reduce((soma, l) => {
      const c = cfg.find((cc) => cc.codigo === l.estagio);
      if (!c) {
        return soma;
      }
      return soma + (valorDoLead(l) * c.pesoPercent) / 100;
    }, 0);
}

export function taxaLeadParaProposta(leads: LeadFunil[]): {
  alcancaram: number;
  total: number;
  percent: number;
} {
  const total = leads.length;
  const alcancaram = leads.filter(
    (l) =>
      l.estagio === "PROPOSAL" ||
      l.situacao === "GANHO" ||
      (l.situacao === "PERDIDO" && l.perdidoNoEstagio === "PROPOSAL")
  ).length;
  return {
    alcancaram,
    total,
    percent: total === 0 ? 0 : Math.round((alcancaram / total) * 100),
  };
}

export function cacSobreAcvGanho(
  leads: LeadFunil[],
  canais: { slug: string; cacMedioCentavos: number | null }[]
): { cacCentavos: number; acvGanhoCentavos: number; percent: number | null } {
  const ganhos = leads.filter((l) => l.situacao === "GANHO");
  const acvGanhoCentavos = ganhos.reduce((soma, l) => soma + valorDoLead(l), 0);

  let cacCentavos = 0;
  let medidos = 0;
  for (const l of ganhos) {
    const canal = canais.find((c) => c.slug === l.canalSlug);
    if (canal && canal.cacMedioCentavos !== null) {
      cacCentavos += canal.cacMedioCentavos;
      medidos += 1;
    }
  }

  const percent =
    acvGanhoCentavos > 0 && medidos > 0
      ? Math.round((cacCentavos / acvGanhoCentavos) * 100)
      : null;

  return { cacCentavos, acvGanhoCentavos, percent };
}

export type Transicao = {
  leadId: string;
  de: string | null;
  para: string;
  em: string;
};

/** Estados que contam como "avançou" quando são a transição seguinte de um
 * lead que entrou no estágio — o próximo estágio da sequência, ou os dois
 * desfechos de promoção que pulam a sequência (proposta emitida, ganho). */
function ehAvanco(estagio: Estagio, para: string): boolean {
  return (
    para === proximoEstagio(estagio) || para === "PROPOSAL" || para === "GANHO"
  );
}

export function metricasDoEstagio(
  historico: Transicao[],
  estagio: Estagio,
  hoje: Date,
  janelaDias = 90
): {
  entraram: number;
  avancaram: number;
  perdidos: number;
  permanenciaMediaDias: number | null;
} {
  const entradas = historico.filter(
    (t) => t.para === estagio && diasEntre(new Date(t.em), hoje) <= janelaDias
  );

  let avancaram = 0;
  let perdidos = 0;
  const permanencias: number[] = [];

  for (const entrada of entradas) {
    const entradaEm = new Date(entrada.em);
    const entradaMs = entradaEm.getTime();
    const proxima = historico
      .filter(
        (t) =>
          t.leadId === entrada.leadId && new Date(t.em).getTime() > entradaMs
      )
      .sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime())[0];

    if (!proxima) {
      continue; // ainda no estágio — não entra na permanência.
    }

    permanencias.push(diasEntre(entradaEm, new Date(proxima.em)));

    if (proxima.para === "PERDIDO") {
      perdidos += 1;
    } else if (ehAvanco(estagio, proxima.para)) {
      avancaram += 1;
    }
    // Movimento para outro estágio (ex.: voltar) conta na permanência (saiu),
    // mas não em avançaram nem perdidos.
  }

  const permanenciaMediaDias =
    permanencias.length === 0
      ? null
      : Math.round(
          permanencias.reduce((a, b) => a + b, 0) / permanencias.length
        );

  return {
    entraram: entradas.length,
    avancaram,
    perdidos,
    permanenciaMediaDias,
  };
}

export function proximoEstagio(e: Estagio): Estagio | null {
  const i = ESTAGIOS.indexOf(e);
  return i >= 0 && i < ESTAGIOS.length - 1 ? ESTAGIOS[i + 1] : null;
}

export function podeMover(l: LeadFunil): boolean {
  return l.situacao === "ATIVO" && ABERTOS.includes(l.estagio as EstagioAberto);
}

export function podeConverter(l: LeadFunil): boolean {
  return l.situacao === "ATIVO" && l.estagio === "EVALUATION";
}
