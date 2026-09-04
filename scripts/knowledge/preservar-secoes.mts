export const SECOES_RESERVADAS = ["## Estado de tarefa", "## Obstáculos"] as const;

/** Corpo de uma seção `## Título`: da linha seguinte ao título até a próxima
 *  linha que comece com `## ` ou o fim. Sem trims internos — o que o
 *  especialista escreveu volta byte a byte; só as linhas em branco das bordas
 *  saem, porque são separação de seção, não conteúdo. */
export function extrairSecao(markdown: string, titulo: string): string | null {
  const linhas = markdown.split("\n");
  const inicio = linhas.findIndex((l) => l.trimEnd() === titulo);
  if (inicio === -1) {
    return null;
  }
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (linhas[i].startsWith("## ")) {
      fim = i;
      break;
    }
  }
  const corpo = linhas.slice(inicio + 1, fim);
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
  const inicio = linhas.findIndex((l) => l.trimEnd() === titulo);
  if (inicio === -1) {
    return `${markdown.replace(/\n*$/, "")}\n\n${titulo}\n${corpo}\n`;
  }
  let fim = linhas.length;
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (linhas[i].startsWith("## ")) {
      fim = i;
      break;
    }
  }
  const novoCorpo = corpo === "" ? [""] : [...corpo.split("\n"), ""];
  return [...linhas.slice(0, inicio + 1), ...novoCorpo, ...linhas.slice(fim)].join("\n");
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
