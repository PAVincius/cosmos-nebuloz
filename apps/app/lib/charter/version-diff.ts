// version-diff.ts — montagem "dois snapshots → linhas de diff por seção" (FR-2.6).
//
// Puro: sem React, sem I/O, sem banco. Mora aqui, e não dentro de
// `getVersionDiff`, porque tem dois donos — a tela (getVersionDiff → DiffModal)
// e o pacote de evidência (exportEvidence). Com uma montagem por chamador, o
// CSV que o auditor recebe poderia discordar da tela que a compliance lead
// abriu; num artefato de evidência essa divergência é o pior defeito possível.
//
// A fonte da verdade é o `snapshot` de CharterPolicyVersion: imutável, gravado
// na publicação. Por isso o diff é derivado na leitura em vez de gravado no
// evento de auditoria — gravar o texto das seções lá guardaria o mesmo
// conteúdo uma terceira vez no banco, e duas cópias divergem.

import { diffTexto, type Segmento } from "./diff";

/** Uma seção como o `snapshot` da versão publicada a guarda. */
export type SnapshotSection = {
  ordinal: number;
  name: string;
  body: string;
  status: string;
};

/**
 * Uma linha do diff. Carrega os segmentos do `lib/charter/diff` em vez do par
 * de excertos de 180 caracteres que existia aqui: o recorte fazia mudança em
 * parágrafo distante devolver dois blocos idênticos sob "Antes" e "Depois", e
 * concatenava `…` mesmo em seção que cabia inteira.
 */
export type VersionDiffRow = {
  field: string;
  segmentos: Segmento[];
  /** Seção que não existia na versão anterior — todo o corpo é adicionado. */
  nova: boolean;
  /** Texto grande demais para comparar inteiro; quem exibe precisa dizer isso. */
  truncado: boolean;
  linhasOmitidas: number;
};

/**
 * Lê o campo `snapshot` (Json do Prisma) sem confiar no formato. Versão antiga
 * ou dado manipulado devolve lista vazia em vez de derrubar a exportação —
 * pacote de evidência que falha inteiro por causa de uma linha é pior do que
 * pacote que entrega o resto.
 */
export function snapshotSections(valor: unknown): SnapshotSection[] {
  return Array.isArray(valor) ? (valor as SnapshotSection[]) : [];
}

function linhaDeDiff(
  field: string,
  antes: string,
  depois: string,
  nova = false
): VersionDiffRow {
  const d = diffTexto(antes, depois);
  return {
    field,
    segmentos: d.segmentos,
    nova,
    truncado: d.truncado,
    linhasOmitidas: d.linhasOmitidas,
  };
}

/**
 * Linhas de diff entre o snapshot da versão anterior e o da versão publicada.
 *
 * Casa seção por `ordinal`, não por nome: renomear a seção 4 é mudança a
 * declarar, não seção nova. Seção só no snapshot atual é `nova`. Seção só no
 * anterior não vira linha — nenhuma action do app cria ou apaga
 * `charterPolicySection`, então esse estado não é alcançável.
 */
export function diffDeSnapshots(
  anterior: readonly SnapshotSection[],
  atual: readonly SnapshotSection[]
): VersionDiffRow[] {
  const anteriorPorOrdinal = new Map(anterior.map((s) => [s.ordinal, s]));

  const rows: VersionDiffRow[] = [];
  for (const s of atual) {
    const ordinal = String(s.ordinal).padStart(2, "0");
    const b = anteriorPorOrdinal.get(s.ordinal);
    if (!b) {
      rows.push(linhaDeDiff(`S${ordinal} · ${s.name}`, "", s.body, true));
      continue;
    }
    if (b.body !== s.body) {
      rows.push(linhaDeDiff(`S${ordinal} · ${s.name}`, b.body, s.body));
    }
    if (b.name !== s.name) {
      rows.push(linhaDeDiff(`Nome de S${ordinal}`, b.name, s.name));
    }
  }
  return rows;
}
