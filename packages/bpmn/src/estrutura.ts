/**
 * Checagens estruturais próprias, sobre um grafo neutro — serve tanto para a
 * definição JSON quanto para um XML vindo do editor. O bpmnlint cobre forma
 * (rótulo, DI, evento de fim); isto cobre o que ele não garante: que o
 * processo inteiro é percorrível do início e que todo caminho termina.
 */

export type NoDoGrafo = {
  id: string;
  tipo: "inicio" | "fim" | "gateway" | "outro";
  nome: string;
  /** Evento de borda: alcançável quando a atividade hospedeira é. */
  hospedeiro?: string;
};

export type FluxoDoGrafo = { de: string; para: string; rotulo?: string };

export type Grafo = { nos: NoDoGrafo[]; fluxos: FluxoDoGrafo[] };

function nomeDe(n: NoDoGrafo): string {
  return n.nome.trim() ? `"${n.nome.trim()}" (${n.id})` : n.id;
}

function alcancaveis(
  origens: string[],
  vizinhos: Map<string, string[]>
): Set<string> {
  const vistos = new Set(origens);
  const fila = [...origens];
  while (fila.length > 0) {
    const atual = fila.shift() as string;
    for (const v of vizinhos.get(atual) ?? []) {
      if (!vistos.has(v)) {
        vistos.add(v);
        fila.push(v);
      }
    }
  }
  return vistos;
}

function adjacencias(g: Grafo) {
  const frente = new Map<string, string[]>();
  const tras = new Map<string, string[]>();
  const ligar = (m: Map<string, string[]>, a: string, b: string) => {
    m.set(a, [...(m.get(a) ?? []), b]);
  };
  for (const f of g.fluxos) {
    ligar(frente, f.de, f.para);
    ligar(tras, f.para, f.de);
  }
  // A borda "sai" da hospedeira: para alcance, é uma aresta implícita.
  for (const n of g.nos) {
    if (n.hospedeiro) {
      ligar(frente, n.hospedeiro, n.id);
      ligar(tras, n.id, n.hospedeiro);
    }
  }
  return { frente, tras };
}

function problemasDeGateway(g: Grafo): string[] {
  const problemas: string[] = [];
  for (const n of g.nos.filter((x) => x.tipo === "gateway")) {
    const saidas = g.fluxos.filter((f) => f.de === n.id);
    const entradas = g.fluxos.filter((f) => f.para === n.id);
    if (saidas.length >= 2) {
      const semRotulo = saidas.filter((f) => !f.rotulo?.trim());
      if (semRotulo.length > 0) {
        problemas.push(
          `gateway ${nomeDe(n)} tem ${semRotulo.length} saída(s) sem rótulo de condição`
        );
      }
    } else if (saidas.length === 1 && entradas.length < 2) {
      problemas.push(
        `gateway ${nomeDe(n)} não decide nada: precisa de duas saídas rotuladas, ou de duas entradas se for junção`
      );
    }
  }
  return problemas;
}

/** Lista de problemas em português; vazia quando o grafo é válido. */
export function checarEstrutura(g: Grafo): string[] {
  const problemas: string[] = [];
  const inicios = g.nos.filter((n) => n.tipo === "inicio");
  const fins = g.nos.filter((n) => n.tipo === "fim");
  if (inicios.length === 0) {
    problemas.push("o processo não tem evento de início");
  }
  if (fins.length === 0) {
    problemas.push("o processo não tem evento de fim");
  }

  for (const n of inicios) {
    if (g.fluxos.some((f) => f.para === n.id)) {
      problemas.push(
        `início ${nomeDe(n)} recebe fluxo — início não tem entrada`
      );
    }
  }
  for (const n of fins) {
    if (g.fluxos.some((f) => f.de === n.id)) {
      problemas.push(`fim ${nomeDe(n)} tem fluxo que sai — fim não tem saída`);
    }
  }

  const { frente, tras } = adjacencias(g);
  if (inicios.length > 0) {
    const vistos = alcancaveis(
      inicios.map((n) => n.id),
      frente
    );
    for (const n of g.nos.filter((x) => !vistos.has(x.id))) {
      problemas.push(`${nomeDe(n)} não é alcançável a partir do início`);
    }
  }
  if (fins.length > 0) {
    const chegam = alcancaveis(
      fins.map((n) => n.id),
      tras
    );
    for (const n of g.nos.filter((x) => !chegam.has(x.id))) {
      problemas.push(`${nomeDe(n)} não chega a um fim`);
    }
  } else {
    // Sem fim nenhum, apontar todo nó seria ruído: o que ajuda é onde o
    // caminho para.
    for (const n of g.nos.filter((x) => !frente.has(x.id))) {
      problemas.push(
        `${nomeDe(n)} não chega a um fim — o caminho para ali sem evento de fim`
      );
    }
  }

  return [...problemas, ...problemasDeGateway(g)];
}
