/**
 * Slug a partir de um nome.
 *
 * Compartilhado entre diagramas e biblioteca de IP: as duas entidades geram
 * slug do nome, e duas cópias divergiriam na primeira vez que alguém ajustasse
 * o tratamento de acento — aí o mesmo nome geraria slugs diferentes conforme a
 * tela, e o unique do banco recusaria sem explicar por quê.
 *
 * Não é o slugify do provisioning: aquele é de tenant e carrega regras de nome
 * reservado que não valem aqui.
 */

const ACENTO = /[̀-ͯ]/g;
const NAO_ALFANUM = /[^a-z0-9]+/g;
const BORDA_HIFEN = /(^-|-$)/g;

export function slugificar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(ACENTO, "")
    .toLowerCase()
    .replace(NAO_ALFANUM, "-")
    .replace(BORDA_HIFEN, "");
}
