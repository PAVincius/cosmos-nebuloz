// Validação das referências de entregável ao catálogo do Charter (D-23 F1).
//
// Pura: recebe os corpora, não lê banco. A referência é {set, versao, codigo}, o
// que é estável entre ambientes, e vale só se existe um conjunto global de
// regulação com aquele nome e versão contendo aquele código. Referência a
// exigência inexistente é recusada na publicação: um entregável que "cobre" uma
// cláusula que o catálogo não tem seria cobertura de papel.

import type { CorpusSeed } from "./regulacao-corpora";
import type { RequirementRefSeed } from "./scaffold-templates";

type Corpora = readonly Pick<CorpusSeed, "nome" | "versao" | "requisitos">[];

/** As referências que não existem no catálogo, cada uma com o motivo. */
export function findInvalidRequirementRefs(
  refs: readonly RequirementRefSeed[],
  corpora: Corpora
): { ref: RequirementRefSeed; motivo: string }[] {
  const invalidas: { ref: RequirementRefSeed; motivo: string }[] = [];
  for (const ref of refs) {
    const corpus = corpora.find(
      (c) => c.nome === ref.set && c.versao === ref.versao
    );
    if (!corpus) {
      invalidas.push({
        ref,
        motivo: `Conjunto "${ref.set}" versão ${ref.versao} não existe no catálogo.`,
      });
    } else if (!corpus.requisitos.some((r) => r.codigo === ref.codigo)) {
      invalidas.push({
        ref,
        motivo: `O código ${ref.codigo} não existe em "${ref.set}".`,
      });
    }
  }
  return invalidas;
}
