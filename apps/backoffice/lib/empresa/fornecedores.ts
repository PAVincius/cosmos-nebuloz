/**
 * Transições do estado do DPA (spec §3.1).
 *
 * Só existem as que a tela oferece. `ASSINADO` exige evidência: sem ela o
 * estado seria afirmação, e o documento de 5 set existe justamente para
 * separar afirmação de prova.
 */

export type EstadoDpa = "EMBUTIDO" | "A_ASSINAR" | "ASSINADO" | "SEM_DOCUMENTO";
export type AcaoDpa = "MARCAR_ACEITO" | "REGISTRAR_PEDIDO";

export type PosturaDpa = { estado: EstadoDpa; evidenciaUrl: string | null };

export type PatchDpa = {
  estado: EstadoDpa;
  evidenciaUrl?: string;
  assinadoEm?: Date;
  pedidoEm?: Date;
};

const ACOES: Record<EstadoDpa, AcaoDpa[]> = {
  EMBUTIDO: [],
  A_ASSINAR: ["MARCAR_ACEITO"],
  SEM_DOCUMENTO: ["REGISTRAR_PEDIDO", "MARCAR_ACEITO"],
  ASSINADO: [],
};

export function acoesDisponiveis(estado: EstadoDpa): AcaoDpa[] {
  return ACOES[estado];
}

export function aplicarAcao(
  atual: PosturaDpa,
  acao: AcaoDpa,
  agora: Date,
  evidenciaUrl?: string
): { ok: true; patch: PatchDpa } | { ok: false; erro: string } {
  if (!ACOES[atual.estado].includes(acao)) {
    return {
      ok: false,
      erro: `Fornecedor em ${atual.estado} não aceita ${acao}.`,
    };
  }
  if (acao === "REGISTRAR_PEDIDO") {
    return { ok: true, patch: { estado: atual.estado, pedidoEm: agora } };
  }
  const evidencia = evidenciaUrl?.trim();
  if (!evidencia) {
    return {
      ok: false,
      erro: "Marcar como assinado exige o link da via assinada ou do aceite.",
    };
  }
  return {
    ok: true,
    patch: { estado: "ASSINADO", evidenciaUrl: evidencia, assinadoEm: agora },
  };
}

export type Contadores = {
  embutidos: number;
  aAssinar: number;
  semDocumento: number;
  bloqueiamVenda: number;
};

export function contadores(
  lista: { estado: EstadoDpa; bloqueiaVenda: boolean }[]
): Contadores {
  return contadoresDosGrupos(lista.map((f) => ({ ...f, quantidade: 1 })));
}

/** Os mesmos contadores a partir de um `groupBy` por estado e bloqueio: o
 *  inventário inteiro sem ler as linhas, que agora vêm paginadas. */
export function contadoresDosGrupos(
  grupos: { estado: EstadoDpa; bloqueiaVenda: boolean; quantidade: number }[]
): Contadores {
  const c: Contadores = {
    embutidos: 0,
    aAssinar: 0,
    semDocumento: 0,
    bloqueiamVenda: 0,
  };
  for (const g of grupos) {
    if (g.estado === "EMBUTIDO") {
      c.embutidos += g.quantidade;
    }
    if (g.estado === "A_ASSINAR") {
      c.aAssinar += g.quantidade;
    }
    if (g.estado === "SEM_DOCUMENTO") {
      c.semDocumento += g.quantidade;
    }
    if (g.bloqueiaVenda && g.estado !== "ASSINADO") {
      c.bloqueiamVenda += g.quantidade;
    }
  }
  return c;
}
