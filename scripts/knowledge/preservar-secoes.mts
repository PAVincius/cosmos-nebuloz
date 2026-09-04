export const SECOES_RESERVADAS = ["## Estado de tarefa", "## Obstáculos"] as const;

/** Índices [inicio, fim) do corpo da seção `titulo`: da linha após o título
 *  até a próxima linha `## ` FORA de bloco de código, ou o fim. Uma linha que
 *  começa com ``` alterna o estado de fence; dentro dela, `## ` é conteúdo,
 *  não título — senão um trecho de markdown colado pelo especialista
 *  truncaria a própria seção. */
function limitesSecao(
  linhas: string[],
  titulo: string
): { inicio: number; fim: number } | null {
  const inicio = linhas.findIndex((l) => l.trimEnd() === titulo);
  if (inicio === -1) {
    return null;
  }
  let emFence = false;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (linhas[i].trimStart().startsWith("```")) {
      emFence = !emFence;
      continue;
    }
    if (!emFence && linhas[i].startsWith("## ")) {
      return { inicio, fim: i };
    }
  }
  return { inicio, fim: linhas.length };
}

/** Corpo de uma seção `## Título`: da linha seguinte ao título até a próxima
 *  linha que comece com `## ` ou o fim. Sem trims internos — o que o
 *  especialista escreveu volta byte a byte; só as linhas em branco das bordas
 *  saem, porque são separação de seção, não conteúdo. */
export function extrairSecao(markdown: string, titulo: string): string | null {
  const linhas = markdown.split("\n");
  const limites = limitesSecao(linhas, titulo);
  if (limites === null) {
    return null;
  }
  const corpo = linhas.slice(limites.inicio + 1, limites.fim);
  while (corpo.length && corpo[0].trim() === "") {
    corpo.shift();
  }
  while (corpo.length && corpo[corpo.length - 1].trim() === "") {
    corpo.pop();
  }
  return corpo.join("\n");
}

function substituirSecao(markdown: string, titulo: string, corpo: string): string {
  const linhas = markdown.split("\n");
  const limites = limitesSecao(linhas, titulo);
  if (limites === null) {
    return `${markdown.replace(/\n*$/, "")}\n\n${titulo}\n${corpo}\n`;
  }
  const novoCorpo = corpo === "" ? [""] : [...corpo.split("\n"), ""];
  return [...linhas.slice(0, limites.inicio + 1), ...novoCorpo, ...linhas.slice(limites.fim)].join("\n");
}

/**
 * Regenera a note preservando o que só o especialista escreve.
 * Direção única: o gerado substitui tudo, exceto as seções reservadas, que
 * voltam da note atual. Seção ausente na atual vira aviso, não erro.
 */
export function preservarSecoes(
  noteAtual: string | null,
  noteGerada: string
): { note: string; avisos: string[] } {
  if (noteAtual === null) {
    return { note: noteGerada, avisos: [] };
  }
  const avisos: string[] = [];
  let note = noteGerada;
  for (const titulo of SECOES_RESERVADAS) {
    const corpo = extrairSecao(noteAtual, titulo);
    if (corpo === null) {
      avisos.push(`seção "${titulo}" ausente na note atual — recriada vazia`);
      continue;
    }
    note = substituirSecao(note, titulo, corpo);
  }
  return { note, avisos };
}
