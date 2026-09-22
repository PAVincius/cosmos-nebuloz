// diff.ts — diff de texto para o comparador de versões de política (FR-2.6).
//
// Puro: sem React, sem I/O, sem banco. Quem chama é `getVersionDiff` no
// servidor e `DiffModal` no cliente, então o resultado precisa ser serializável
// e não pode depender de nada de ambiente.
//
// Algoritmo: LCS clássico por linha (DP), não Myers. A entrada aqui é seção de
// política — dezenas de linhas, não arquivo de código com milhares —, e o DP
// cabe em memória com folga e sem heurística que erre em caso difícil. Sem
// dependência nova: o repo não tem lib de diff e não vale puxar uma por isto.
//
// O caso que manda no desenho: seção de política costuma ser um parágrafo
// corrido, uma linha só. Diff por linha nesse texto degenera em "tudo mudou" —
// que é exatamente a mentira que este módulo existe para corrigir. Por isso um
// par removida/adicionada de linha longa é reaberto em diff por palavra e as
// partes iguais voltam a se declarar iguais (`partes`).
//
// Nada é truncado em silêncio. Há um teto de linhas para o DP não estourar
// memória com entrada patológica, e quando ele vale o dado diz: `truncado` e
// `linhasOmitidas`. O que é exibido é sempre diff verdadeiro do que entrou.

export type TipoSegmento = "igual" | "adicionada" | "removida";

/** Fragmento de palavra dentro de uma linha reescrita. */
export type ParteSegmento = {
  tipo: TipoSegmento;
  texto: string;
};

/** Uma linha do diff. `linhaAntes`/`linhaDepois` são 1-based. */
export type Segmento = {
  tipo: TipoSegmento;
  texto: string;
  linhaAntes?: number;
  linhaDepois?: number;
  /**
   * Presente só quando a linha foi reescrita e é longa demais para o diff por
   * linha dizer algo útil. Concatenar `texto` das partes devolve a linha
   * inteira — o recuo nunca perde caractere.
   */
  partes?: ParteSegmento[];
};

export type DiffTexto = {
  segmentos: Segmento[];
  /** Verdadeiro quando o teto de linhas valeu e parte do texto não entrou. */
  truncado: boolean;
  /** Quantas linhas ficaram de fora da comparação, somando os dois lados. */
  linhasOmitidas: number;
};

export type BlocoDiff = {
  tipo: "mudanca" | "colapsado";
  segmentos: Segmento[];
  linhas: number;
};

/** Teto do DP por linha. Acima disto o dado declara o que ficou de fora. */
const MAX_LINHAS = 2000;
/** A partir daqui uma linha reescrita vira diff por palavra. */
const LIMIAR_LINHA_LONGA = 80;
/** Teto do DP por palavra — linha absurda não derruba o servidor. */
const MAX_PALAVRAS = 800;
const QUEBRA_DE_LINHA = /\r\n?/g;
/** Grupo capturante: o espaço vira token e a junção não perde caractere. */
const ESPACO = /(\s+)/;

function linhasDe(texto: string): string[] {
  if (texto === "") {
    return [];
  }
  return texto.replace(QUEBRA_DE_LINHA, "\n").split("\n");
}

/**
 * `tab[i][j]` = comprimento da maior subsequência comum de `a[i:]` e `b[j:]`.
 * Preenchida de trás para frente para o passeio adiante ser direto.
 */
function tabelaLcs(a: readonly string[], b: readonly string[]): Int32Array[] {
  const tab = Array.from(
    { length: a.length + 1 },
    () => new Int32Array(b.length + 1)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    const atual = tab[i];
    const proxima = tab[i + 1];
    for (let j = b.length - 1; j >= 0; j--) {
      atual[j] =
        a[i] === b[j] ? proxima[j + 1] + 1 : Math.max(proxima[j], atual[j + 1]);
    }
  }
  return tab;
}

type Passo = { tipo: TipoSegmento; texto: string; a: number; b: number };

/**
 * Passeio pela tabela. Em divergência, remoção sai antes da adição — é o que
 * deixa o par reescrito adjacente e permite reabri-lo por palavra depois.
 */
function passos(a: readonly string[], b: readonly string[]): Passo[] {
  const tab = tabelaLcs(a, b);
  const saida: Passo[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      saida.push({ tipo: "igual", texto: a[i], a: i, b: j });
      i++;
      j++;
    } else if (tab[i + 1][j] >= tab[i][j + 1]) {
      saida.push({ tipo: "removida", texto: a[i], a: i, b: j });
      i++;
    } else {
      saida.push({ tipo: "adicionada", texto: b[j], a: i, b: j });
      j++;
    }
  }
  for (; i < a.length; i++) {
    saida.push({ tipo: "removida", texto: a[i], a: i, b: j });
  }
  for (; j < b.length; j++) {
    saida.push({ tipo: "adicionada", texto: b[j], a: i, b: j });
  }
  return saida;
}

/** Quebra mantendo os espaços como token — junta tudo de volta sem perda. */
function palavrasDe(linha: string): string[] {
  return linha.split(ESPACO).filter((t) => t !== "");
}

function juntarPartes(brutas: ParteSegmento[]): ParteSegmento[] {
  const saida: ParteSegmento[] = [];
  for (const parte of brutas) {
    const ultima = saida.at(-1);
    if (ultima?.tipo === parte.tipo) {
      saida[saida.length - 1] = {
        tipo: ultima.tipo,
        texto: ultima.texto + parte.texto,
      };
      continue;
    }
    saida.push(parte);
  }
  return saida;
}

/**
 * Diff por palavra de um par de linhas reescritas. Devolve as partes de cada
 * lado — o lado removido não carrega o que foi adicionado, e vice-versa.
 */
function partesDoPar(
  antes: string,
  depois: string
): { antes: ParteSegmento[]; depois: ParteSegmento[] } | null {
  const a = palavrasDe(antes);
  const b = palavrasDe(depois);
  if (a.length > MAX_PALAVRAS || b.length > MAX_PALAVRAS) {
    return null;
  }
  const brutos = passos(a, b);
  return {
    antes: juntarPartes(
      brutos
        .filter((p) => p.tipo !== "adicionada")
        .map((p) => ({ tipo: p.tipo, texto: p.texto }))
    ),
    depois: juntarPartes(
      brutos
        .filter((p) => p.tipo !== "removida")
        .map((p) => ({ tipo: p.tipo, texto: p.texto }))
    ),
  };
}

function ehParLongo(antes: Segmento, depois: Segmento): boolean {
  return Math.max(antes.texto.length, depois.texto.length) > LIMIAR_LINHA_LONGA;
}

/** Reabre por palavra todo par removida→adicionada de linha longa. */
function recuarParaPalavra(segmentos: Segmento[]): Segmento[] {
  const saida = [...segmentos];
  for (let i = 0; i < saida.length - 1; i++) {
    const antes = saida[i];
    const depois = saida[i + 1];
    if (
      antes.tipo !== "removida" ||
      depois.tipo !== "adicionada" ||
      !ehParLongo(antes, depois)
    ) {
      continue;
    }
    const partes = partesDoPar(antes.texto, depois.texto);
    if (!partes) {
      continue;
    }
    saida[i] = { ...antes, partes: partes.antes };
    saida[i + 1] = { ...depois, partes: partes.depois };
    i++;
  }
  return saida;
}

/**
 * Diff por linha entre dois textos, com recuo para diff por palavra quando a
 * linha reescrita é longa. Não trunca em silêncio: acima de `MAX_LINHAS` o
 * resultado declara `truncado` e quantas linhas ficaram de fora.
 */
export function diffTexto(antes: string, depois: string): DiffTexto {
  const todasA = linhasDe(antes);
  const todasB = linhasDe(depois);
  const a = todasA.slice(0, MAX_LINHAS);
  const b = todasB.slice(0, MAX_LINHAS);
  const linhasOmitidas = todasA.length - a.length + (todasB.length - b.length);

  const segmentos = passos(a, b).map((p): Segmento => {
    if (p.tipo === "removida") {
      return { tipo: p.tipo, texto: p.texto, linhaAntes: p.a + 1 };
    }
    if (p.tipo === "adicionada") {
      return { tipo: p.tipo, texto: p.texto, linhaDepois: p.b + 1 };
    }
    return {
      tipo: p.tipo,
      texto: p.texto,
      linhaAntes: p.a + 1,
      linhaDepois: p.b + 1,
    };
  });

  return {
    segmentos: recuarParaPalavra(segmentos),
    truncado: linhasOmitidas > 0,
    linhasOmitidas,
  };
}

/**
 * Agrupa os segmentos para exibição: mantém `contexto` linhas iguais ao redor
 * de cada mudança e junta o resto em blocos colapsados com a contagem. Nenhum
 * segmento é descartado — o bloco colapsado carrega os seus, então abrir é só
 * deixar de esconder.
 */
export function agruparSegmentos(
  segmentos: readonly Segmento[],
  contexto = 2
): BlocoDiff[] {
  const visivel = new Array<boolean>(segmentos.length).fill(false);
  segmentos.forEach((s, i) => {
    if (s.tipo === "igual") {
      return;
    }
    const inicio = Math.max(0, i - contexto);
    const fim = Math.min(segmentos.length - 1, i + contexto);
    for (let k = inicio; k <= fim; k++) {
      visivel[k] = true;
    }
  });

  const blocos: BlocoDiff[] = [];
  for (const [i, segmento] of segmentos.entries()) {
    const tipo = visivel[i] ? "mudanca" : "colapsado";
    const ultimo = blocos.at(-1);
    if (ultimo?.tipo === tipo) {
      ultimo.segmentos.push(segmento);
      ultimo.linhas++;
      continue;
    }
    blocos.push({ tipo, segmentos: [segmento], linhas: 1 });
  }
  return blocos;
}
