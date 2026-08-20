/**
 * Transporte de cobertura entre duas versões de um conjunto de exigências.
 *
 * Os requisitos da versão nova são linhas com ids novos, e `getComplianceMap`
 * busca cobertura por id de requisito sem nunca percorrer `supersedesId` — sem
 * transportar, todo veredito (inclusive o que não mudou) some da vista no
 * instante seguinte à publicação.
 *
 * Função pura de propósito: recebe o que já foi lido do banco e devolve as
 * linhas a inserir. Quem chama abre as queries e a transação; aqui não há I/O,
 * o que torna a regra testável sem stub de Prisma.
 */

export type CoberturaStatus =
  | "ATENDE"
  | "PARCIAL"
  | "NAO_ATENDE"
  | "SEM_VEREDITO"
  | "REVISAR"
  | "NAO_APLICAVEL";

export type CoberturaAnterior = {
  requirementId: string;
  status: CoberturaStatus;
  comentario: string | null;
  capabilityId: string | null;
};

export type LinhaTransportada = {
  tenantId: string;
  requirementId: string;
  status: CoberturaStatus;
  comentario: string | null;
  capabilityId: string | null;
};

export function planejarTransporte(input: {
  tenantId: string;
  coberturas: CoberturaAnterior[];
  idAnteriorParaCodigo: Map<string, string>;
  novoPorCodigo: Map<string, { id: string }>;
  codigosMudados: Set<string>;
}): LinhaTransportada[] {
  const linhas: LinhaTransportada[] = [];

  for (const cobertura of input.coberturas) {
    const codigo = input.idAnteriorParaCodigo.get(cobertura.requirementId);
    if (!codigo) {
      continue;
    }
    // Código removido: a cobertura não tem para onde ir. Fica intocada no
    // conjunto antigo e só entra na contagem de removidas.
    const novoRequisito = input.novoPorCodigo.get(codigo);
    if (!novoRequisito) {
      continue;
    }
    linhas.push({
      tenantId: input.tenantId,
      requirementId: novoRequisito.id,
      status: input.codigosMudados.has(codigo) ? "REVISAR" : cobertura.status,
      comentario: cobertura.comentario,
      capabilityId: cobertura.capabilityId,
    });
  }

  return linhas;
}
