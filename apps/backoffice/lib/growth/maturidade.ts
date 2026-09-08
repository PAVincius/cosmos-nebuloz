/**
 * Rubrica de maturidade de IA e as contas que ela sustenta.
 *
 * Sem Prisma, sem React, sem I/O: é a mesma conta que a tela usa para desenhar
 * o radar, a action usa para congelar o score no fecho e o relatório usa para
 * justificar o degrau recomendado — três lugares que não podem discordar sobre
 * quanto vale um nível 2 em Governança.
 *
 * A estrutura é a que os frameworks públicos convergem: seis dimensões
 * (estratégia, dados, tecnologia, governança, talento, cultura — recorte EAAI)
 * pontuadas em cinco níveis (Inicial → Otimizado — escala MITRE), com bandas de
 * 0-100 por dimensão. A rubrica em si é IP da Nebuloz: nenhuma linha vem de
 * repositório de terceiro, e por isso ela mora aqui em código, versionada com
 * ele, e não numa tabela de configuração.
 *
 * O motivo de os níveis serem definidos uma vez só, e não por critério, é o
 * mesmo do MITRE: cinco âncoras genéricas aplicadas a vinte dimensões dão uma
 * escala comparável entre elas. Âncora por critério daria noventa textos que
 * ninguém mantém alinhados — e escala que não é comparável não vira benchmark.
 */
import type { ProductModule } from "@repo/database";
import type { Tone } from "@repo/design-system/cosmos/kit";

/** Escala MITRE. 0 é "não começou", não "não sei" — ver `pontuar`. */
export const NIVEIS = [0, 1, 2, 3, 4] as const;
export type Nivel = (typeof NIVEIS)[number];

export const CODIGOS_NIVEL = [
  "INICIAL",
  "ADOTADO",
  "DEFINIDO",
  "GERIDO",
  "OTIMIZADO",
] as const;
export type CodigoNivel = (typeof CODIGOS_NIVEL)[number];

export const INFO_NIVEL: Record<
  Nivel,
  { codigo: CodigoNivel; rotulo: string; definicao: string; tom: Tone }
> = {
  0: {
    codigo: "INICIAL",
    rotulo: "Inicial",
    definicao:
      "Acontece por iniciativa individual. Nada é repetível e ninguém responde por isso.",
    tom: "red",
  },
  1: {
    codigo: "ADOTADO",
    rotulo: "Adotado",
    definicao:
      "Existe em pelo menos uma área, com resultado. Não atravessa a organização.",
    tom: "amber",
  },
  2: {
    codigo: "DEFINIDO",
    rotulo: "Definido",
    definicao:
      "Está escrito, tem dono e é seguido. Ainda não é medido de forma contínua.",
    tom: "blue",
  },
  3: {
    codigo: "GERIDO",
    rotulo: "Gerido",
    definicao: "É medido, tem meta e alguém age quando o número sai da faixa.",
    tom: "accent",
  },
  4: {
    codigo: "OTIMIZADO",
    rotulo: "Otimizado",
    definicao:
      "A própria medição alimenta melhoria. O ciclo roda sem alguém empurrar.",
    tom: "green",
  },
};

export const DIMENSOES = [
  "ESTRATEGIA",
  "DADOS",
  "TECNOLOGIA",
  "GOVERNANCA",
  "TALENTO",
  "CULTURA",
] as const;
export type Dimensao = (typeof DIMENSOES)[number];

export type InfoDimensao = {
  rotulo: string;
  descricao: string;
  /** Peso na média ponderada. A soma das seis é 100 — `pesosSomam100` prova. */
  pesoPercent: number;
  /** Degrau da Escada que endereça esta dimensão quando ela é o elo fraco. */
  degrau: ProductModule;
  tom: Tone;
};

/**
 * Os pesos não são iguais por decisão: estratégia, dados e tecnologia somam 60
 * porque são as três que travam as outras. Governança sem caso de uso é comitê
 * sobre nada; cultura sem ferramenta que funcione é discurso. Cultura pesa 10
 * não por ser irrelevante — é a que mais se move sozinha quando as outras cinco
 * andam.
 */
export const INFO_DIMENSAO: Record<Dimensao, InfoDimensao> = {
  ESTRATEGIA: {
    rotulo: "Estratégia e valor",
    descricao: "Quem patrocina, o que se prioriza e como se mede o retorno.",
    pesoPercent: 20,
    degrau: "MERIDIAN",
    tom: "accent",
  },
  DADOS: {
    rotulo: "Dados",
    descricao: "O que alimenta a IA: inventário, qualidade e acesso.",
    pesoPercent: 20,
    degrau: "SIGNAL",
    tom: "blue",
  },
  TECNOLOGIA: {
    rotulo: "Tecnologia e MLOps",
    descricao: "Do experimento à produção: ambiente, entrega e observação.",
    pesoPercent: 20,
    degrau: "SCAFFOLD",
    tom: "purple",
  },
  GOVERNANCA: {
    rotulo: "Governança e risco",
    descricao: "Política, avaliação de risco e dados pessoais.",
    pesoPercent: 15,
    degrau: "CHARTER",
    tom: "amber",
  },
  TALENTO: {
    rotulo: "Talento",
    descricao: "Capacidade dedicada, formação e continuidade do conhecimento.",
    pesoPercent: 15,
    degrau: "SCAFFOLD",
    tom: "green",
  },
  CULTURA: {
    rotulo: "Cultura e adoção",
    descricao: "Uso real, tolerância ao experimento e IA fora do radar.",
    pesoPercent: 10,
    degrau: "COSMOS",
    tom: "neutral",
  },
};

export type Criterio = {
  id: string;
  dimensao: Dimensao;
  pergunta: string;
  /** Evidência a procurar. É o que impede a avaliação de virar auto-elogio. */
  pista: string;
};

/**
 * Dezoito critérios, três por dimensão.
 *
 * Cada `pista` nomeia a evidência que separa o nível declarado do nível real —
 * a pergunta sozinha convida o entrevistado a responder o que soa bem. "Existe
 * política de IA?" é sempre sim; "com data, dono e prova de que o time leu"
 * não é.
 */
export const CRITERIOS: Criterio[] = [
  {
    id: "estrategia.patrocinio",
    dimensao: "ESTRATEGIA",
    pergunta: "Existe patrocínio executivo com orçamento próprio para IA?",
    pista: "Nome, cargo e linha de orçamento. Comitê sem verba não conta.",
  },
  {
    id: "estrategia.portfolio",
    dimensao: "ESTRATEGIA",
    pergunta:
      "O portfólio de casos de uso é priorizado por valor e viabilidade?",
    pista: "Lista escrita com estimativa de impacto e critério de corte.",
  },
  {
    id: "estrategia.retorno",
    dimensao: "ESTRATEGIA",
    pergunta: "O valor gerado por IA é medido em métrica de negócio?",
    pista:
      "Baseline anterior ao piloto. Sem baseline não há medição, há relato.",
  },
  {
    id: "dados.inventario",
    dimensao: "DADOS",
    pergunta: "Os dados que alimentam IA estão inventariados e com dono?",
    pista: "Catálogo com responsável por domínio, não planilha de tabelas.",
  },
  {
    id: "dados.qualidade",
    dimensao: "DADOS",
    pergunta: "A qualidade dos dados é medida de forma contínua?",
    pista:
      "Completude, frescor e duplicidade com alerta — não auditoria anual.",
  },
  {
    id: "dados.acesso",
    dimensao: "DADOS",
    pergunta:
      "O acesso a dados para experimentação é self-service e governado?",
    pista: "Tempo entre pedir e receber um dataset. Semanas é nível baixo.",
  },
  {
    id: "tecnologia.ambiente",
    dimensao: "TECNOLOGIA",
    pergunta: "Os times têm ambiente reprodutível para experimentar com IA?",
    pista:
      "Do zero ao primeiro experimento em quanto tempo, medido em alguém real.",
  },
  {
    id: "tecnologia.entrega",
    dimensao: "TECNOLOGIA",
    pergunta: "Modelos e agentes chegam a produção por pipeline automatizado?",
    pista: "Frequência de entrega e existência de rollback testado.",
  },
  {
    id: "tecnologia.observabilidade",
    dimensao: "TECNOLOGIA",
    pergunta: "Há observabilidade de custo, latência e qualidade das saídas?",
    pista: "Custo por chamada e avaliação automática de saída, não só uptime.",
  },
  {
    id: "governanca.politica",
    dimensao: "GOVERNANCA",
    pergunta: "Existe política de uso de IA publicada e conhecida?",
    pista: "Documento com data, dono e evidência de que o time leu.",
  },
  {
    id: "governanca.risco",
    dimensao: "GOVERNANCA",
    pergunta: "Riscos de IA são avaliados antes do go-live?",
    pista: "Checklist aplicado a um caso real, não modelo em branco.",
  },
  {
    id: "governanca.dados-pessoais",
    dimensao: "GOVERNANCA",
    pergunta: "O tratamento de dados pessoais por IA está mapeado?",
    pista: "Base legal por finalidade e registro no ROPA, com data de revisão.",
  },
  {
    id: "talento.capacidade",
    dimensao: "TALENTO",
    pergunta: "Existe capacidade dedicada — não emprestada — para IA?",
    pista: "Pessoas com alocação formal, não voluntariado fora do horário.",
  },
  {
    id: "talento.formacao",
    dimensao: "TALENTO",
    pergunta: "Há trilha de formação em IA com conclusão medida?",
    pista: "Percentual que concluiu, não percentual que se inscreveu.",
  },
  {
    id: "talento.continuidade",
    dimensao: "TALENTO",
    pergunta: "O conhecimento sobrevive à saída de uma pessoa?",
    pista: "Mais de um dono por sistema de IA crítico, provado em férias.",
  },
  {
    id: "cultura.adocao",
    dimensao: "CULTURA",
    pergunta: "As ferramentas de IA aprovadas são usadas no dia a dia?",
    pista: "Uso ativo semanal, não licenças compradas.",
  },
  {
    id: "cultura.experimento",
    dimensao: "CULTURA",
    pergunta: "Encerrar um experimento sem sucesso é aceitável e registrado?",
    pista:
      "Existe pelo menos um registro de experimento encerrado por não funcionar.",
  },
  {
    id: "cultura.shadow-ai",
    dimensao: "CULTURA",
    pergunta: "O uso de IA fora do que foi aprovado é conhecido e endereçado?",
    pista: "Alguém já mediu. Nunca ter medido é nível 0, não nível alto.",
  },
];

export type Rubrica = {
  versao: string;
  dimensoes: Record<Dimensao, InfoDimensao>;
  criterios: Criterio[];
};

export const RUBRICA_V1: Rubrica = {
  versao: "v1",
  dimensoes: INFO_DIMENSAO,
  criterios: CRITERIOS,
};

/**
 * Versões conhecidas.
 *
 * Existe porque `AvaliacaoDeMaturidade.rubricaVersao` existe: uma avaliação de
 * seis meses atrás precisa ser relida com a rubrica que a pontuou, senão mudar
 * um peso hoje reescreve em silêncio um número que já foi para o cliente.
 * Hoje há uma entrada; o mecanismo é o ponto.
 */
export const RUBRICAS: Record<string, Rubrica> = { v1: RUBRICA_V1 };
export const RUBRICA_ATUAL = RUBRICA_V1.versao;

export function rubricaDe(versao: string): Rubrica | undefined {
  return RUBRICAS[versao];
}

/** Guarda de invariante: média ponderada com pesos que não somam 100 mente. */
export function pesosSomam100(r: Rubrica): boolean {
  const soma = DIMENSOES.reduce((t, d) => t + r.dimensoes[d].pesoPercent, 0);
  return soma === 100;
}

export type Resposta = { criterioId: string; nivel: number };

export type ScoreDaDimensao = {
  dimensao: Dimensao;
  /** 0-100, ou nulo enquanto faltar critério da dimensão. */
  score: number | null;
  nivel: Nivel | null;
  respondidos: number;
  total: number;
};

export type Resultado = {
  porDimensao: ScoreDaDimensao[];
  scoreGeral: number | null;
  nivelGeral: CodigoNivel | null;
  respondidos: number;
  total: number;
  /** Dimensão de menor score — o gargalo. Nulo enquanto o score for nulo. */
  elo: Dimensao | null;
  /** Degrau da Escada que endereça o elo. É o que o CTA da tela oferece. */
  proximoDegrau: ProductModule | null;
};

/** Nível a partir do score, com corte no meio de cada faixa.
 *
 *  Os cortes são 12,5 / 37,5 / 62,5 / 87,5 e não 20 / 40 / 60 / 80 para que
 *  "tudo em nível N" caia na faixa N: quatro respostas nível 1 dão score 25, e
 *  com corte em 20 isso viraria "Definido" — a avaliação diria uma coisa e a
 *  soma das respostas, outra. */
export function nivelDoScore(score: number): Nivel {
  if (score < 12.5) {
    return 0;
  }
  if (score < 37.5) {
    return 1;
  }
  if (score < 62.5) {
    return 2;
  }
  if (score < 87.5) {
    return 3;
  }
  return 4;
}

/** Resposta utilizável: critério que a rubrica conhece, nível dentro da escala.
 *
 *  Fora da faixa é tratado como *não respondido*, não como 0 nem como o valor
 *  mais próximo: dado corrompido que vira zero derruba o score de quem não
 *  merece, e que vira 4 premia quem não merece. Não pontuar é a única leitura
 *  honesta — é a mesma regra do CAC, "sem número, sem chute". */
function ehNivel(n: number): n is Nivel {
  return Number.isInteger(n) && n >= 0 && n <= 4;
}

export function pontuar(
  respostas: Resposta[],
  rubrica: Rubrica = RUBRICA_V1
): Resultado {
  const porCriterio = new Map<string, Nivel>();
  const conhecidos = new Set(rubrica.criterios.map((c) => c.id));
  for (const r of respostas) {
    if (conhecidos.has(r.criterioId) && ehNivel(r.nivel)) {
      porCriterio.set(r.criterioId, r.nivel);
    }
  }

  const porDimensao: ScoreDaDimensao[] = DIMENSOES.map((dimensao) => {
    const daDimensao = rubrica.criterios.filter((c) => c.dimensao === dimensao);
    const niveis = daDimensao
      .map((c) => porCriterio.get(c.id))
      .filter((n): n is Nivel => n !== undefined);
    const completa = niveis.length === daDimensao.length && niveis.length > 0;
    const score = completa
      ? Math.round(
          (niveis.reduce<number>((t, n) => t + n, 0) / (niveis.length * 4)) *
            100
        )
      : null;
    return {
      dimensao,
      score,
      nivel: score === null ? null : nivelDoScore(score),
      respondidos: niveis.length,
      total: daDimensao.length,
    };
  });

  const respondidos = porDimensao.reduce((t, d) => t + d.respondidos, 0);
  const total = porDimensao.reduce((t, d) => t + d.total, 0);
  const completo = porDimensao.every((d) => d.score !== null);

  if (!completo) {
    return {
      porDimensao,
      scoreGeral: null,
      nivelGeral: null,
      respondidos,
      total,
      elo: null,
      proximoDegrau: null,
    };
  }

  const scoreGeral = Math.round(
    porDimensao.reduce(
      (t, d) => t + (d.score ?? 0) * rubrica.dimensoes[d.dimensao].pesoPercent,
      0
    ) / 100
  );

  // Empate resolve pela ordem de `DIMENSOES` — determinístico de propósito: a
  // mesma avaliação tem que recomendar o mesmo degrau em toda releitura.
  const elo = porDimensao.reduce((pior, d) =>
    (d.score ?? 0) < (pior.score ?? 0) ? d : pior
  ).dimensao;

  return {
    porDimensao,
    scoreGeral,
    nivelGeral: INFO_NIVEL[nivelDoScore(scoreGeral)].codigo,
    respondidos,
    total,
    elo,
    proximoDegrau: rubrica.dimensoes[elo].degrau,
  };
}
