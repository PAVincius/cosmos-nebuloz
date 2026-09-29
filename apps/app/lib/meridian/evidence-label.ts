// Rótulo da evidência em Coleta e no gap — ponto único, para trocar sem caçar.
// Hoje é o nome do arquivo (mesmo padrão do painel de divergência). Nome de
// arquivo pode conter dado pessoal: o Lacre dá parecer sobre manter isto
// (specs/010-evidencia-coleta-gap, Coleta). Se mudar, muda só aqui.
export function evidenceLabel(evidence: { fileName: string }): string {
  return evidence.fileName;
}
