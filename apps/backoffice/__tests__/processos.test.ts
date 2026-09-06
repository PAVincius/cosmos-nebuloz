import { describe, expect, it } from "vitest";
import {
  buscar,
  DOMINIOS,
  layoutPolar,
  type Processo,
  paraJsonCanvas,
  statusDe,
  vizinhos,
} from "@/lib/ferramentas/processos";

function p(over: Partial<Processo> & { codigo: string }): Processo {
  return {
    id: over.codigo,
    codigo: over.codigo,
    nome: over.nome ?? "Processo",
    descricao: over.descricao ?? "",
    dominio: over.dominio ?? "COMERCIAL",
    nivel: over.nivel ?? 2,
    tipo: over.tipo ?? "CORE",
    donoNome: over.donoNome ?? null,
    revisadoEm: over.revisadoEm ?? null,
    tags: over.tags ?? [],
    diagramId: over.diagramId ?? null,
    docUrl: over.docUrl ?? null,
    diagram: over.diagram ?? null,
  };
}

describe("statusDe", () => {
  it("com BPMN é modelado, com documento é rascunho, sem nada é não mapeado", () => {
    expect(statusDe(p({ codigo: "PZ-01", diagramId: "d1" }))).toBe("MODELADO");
    expect(statusDe(p({ codigo: "PZ-02", docUrl: "https://x" }))).toBe(
      "RASCUNHO"
    );
    expect(statusDe(p({ codigo: "PZ-03" }))).toBe("NAO_MAPEADO");
  });

  it("BPMN ganha do documento — o modelo é a verdade mais forte", () => {
    expect(
      statusDe(p({ codigo: "PZ-04", diagramId: "d1", docUrl: "https://x" }))
    ).toBe("MODELADO");
  });
});

describe("layoutPolar", () => {
  const nos = [
    p({ codigo: "PZ-01", dominio: "COMERCIAL", nivel: 1 }),
    p({ codigo: "PZ-02", dominio: "COMERCIAL", nivel: 3 }),
    p({ codigo: "PZ-03", dominio: "COMERCIAL", nivel: 3 }),
    p({ codigo: "PZ-04", dominio: "LAB", nivel: 2 }),
  ];

  it("é determinístico", () => {
    expect(layoutPolar(nos).pos).toEqual(layoutPolar(nos).pos);
  });

  it("nível 1 fica mais perto do centro que nível 3", () => {
    const { pos, cx, cy } = layoutPolar(nos);
    const raio = (id: string) => Math.hypot(pos[id].x - cx, pos[id].y - cy);
    expect(raio("PZ-01")).toBeLessThan(raio("PZ-02"));
  });

  it("dois nós do mesmo domínio e nível não caem no mesmo ponto", () => {
    const { pos } = layoutPolar(nos);
    expect(pos["PZ-02"]).not.toEqual(pos["PZ-03"]);
  });

  it("crava a posição de um nó só no seu setor e anel", () => {
    // COMERCIAL é o primeiro setor, com centro em -60°. Nível 1 tem raio
    // 250×128 e, com um nó só, nenhum desvio de raio: x = 780 + cos(-60°)·250
    // = 905, y = 470 + sen(-60°)·128 = 359. Número cravado de propósito —
    // erro de sinal ou troca de anel por setor passa despercebido em teste
    // que só compara nós entre si.
    const { pos } = layoutPolar([
      p({ codigo: "PZ-01", dominio: "COMERCIAL", nivel: 1 }),
    ]);
    expect(pos["PZ-01"]).toEqual({ x: 905, y: 359 });
  });

  it("devolve uma posição para cada nó, e só para eles", () => {
    const { pos } = layoutPolar(nos);
    expect(Object.keys(pos).sort()).toEqual([
      "PZ-01",
      "PZ-02",
      "PZ-03",
      "PZ-04",
    ]);
  });
});

describe("vizinhos", () => {
  const ligacoes = [
    { id: "e1", deId: "PZ-01", paraId: "PZ-02", rotulo: "converte em" },
    { id: "e2", deId: "PZ-03", paraId: "PZ-01", rotulo: "alimenta" },
  ];

  it("separa saída de entrada", () => {
    expect(vizinhos("PZ-01", ligacoes)).toEqual([
      { outro: "PZ-02", dir: "out", rotulo: "converte em", ligacaoId: "e1" },
      { outro: "PZ-03", dir: "in", rotulo: "alimenta", ligacaoId: "e2" },
    ]);
  });

  it("nó sem ligação devolve lista vazia", () => {
    expect(vizinhos("PZ-99", ligacoes)).toEqual([]);
  });
});

describe("buscar", () => {
  const nos = [
    p({ codigo: "PZ-01", nome: "Funil de leads", tags: ["cac", "estágio"] }),
    p({
      codigo: "PZ-02",
      nome: "Gate de fase",
      descricao: "Critérios ou override",
    }),
  ];

  it("consulta vazia não filtra nada", () => {
    expect(buscar("", nos).ids).toBeNull();
  });

  it("ignora acento e caixa", () => {
    expect([...(buscar("ESTAGIO", nos).ids ?? [])]).toEqual(["PZ-01"]);
  });

  it("acha pela descrição", () => {
    expect([...(buscar("override", nos).ids ?? [])]).toEqual(["PZ-02"]);
  });

  it("exige todos os termos, não qualquer um", () => {
    expect([...(buscar("funil override", nos).ids ?? [])]).toEqual([]);
  });

  it("palavra de menos de três letras não conta como termo", () => {
    expect(buscar("de", nos).ids).toBeNull();
  });
});

describe("paraJsonCanvas", () => {
  const nos = [
    p({ codigo: "PZ-01", nome: "Funil de leads", dominio: "COMERCIAL" }),
    p({ codigo: "PZ-02", nome: "Gate de fase", dominio: "DELIVERY" }),
  ];
  const ligacoes = [
    { id: "e1", deId: "PZ-01", paraId: "PZ-02", rotulo: "exige" },
  ];

  it("emite um grupo por domínio presente e um nó por processo", () => {
    const doc = paraJsonCanvas(nos, ligacoes, layoutPolar(nos).pos);
    const grupos = doc.nodes.filter((n) => n.type === "group");
    const arquivos = doc.nodes.filter((n) => n.type === "file");
    expect(grupos).toHaveLength(2);
    expect(arquivos).toHaveLength(2);
  });

  it("nomeia o arquivo do nó pelo código e por um slug sem acento", () => {
    const doc = paraJsonCanvas(nos, ligacoes, layoutPolar(nos).pos);
    const no = doc.nodes.find((n) => n.id === "PZ-01");
    expect(no?.file).toBe("processos/PZ-01-funil-de-leads.md");
  });

  it("nome com pontuação na ponta não deixa hífen solto no arquivo", () => {
    const nos2 = [p({ codigo: "PZ-09", nome: "(Legado) Publicação!" })];
    const doc = paraJsonCanvas(nos2, [], layoutPolar(nos2).pos);
    const no = doc.nodes.find((n) => n.id === "PZ-09");
    expect(no?.file).toBe("processos/PZ-09-legado-publicacao.md");
  });

  it("cada aresta carrega rótulo e seta, com lados vindos da geometria", () => {
    const doc = paraJsonCanvas(nos, ligacoes, layoutPolar(nos).pos);
    expect(doc.edges).toHaveLength(1);
    expect(doc.edges[0].label).toBe("exige");
    expect(doc.edges[0].toEnd).toBe("arrow");
    expect(["top", "right", "bottom", "left"]).toContain(doc.edges[0].fromSide);
  });

  it("descarta aresta cujo nó está fora do conjunto visível", () => {
    const doc = paraJsonCanvas([nos[0]], ligacoes, layoutPolar([nos[0]]).pos);
    expect(doc.edges).toEqual([]);
  });
});

describe("DOMINIOS", () => {
  it("tem os seis domínios do design, cada um com rótulo e tom", () => {
    expect(Object.keys(DOMINIOS)).toEqual([
      "COMERCIAL",
      "DELIVERY",
      "GOVERNANCA",
      "PLATAFORMA",
      "LAB",
      "MEDICAO",
    ]);
    for (const d of Object.values(DOMINIOS)) {
      expect(d.rotulo.length).toBeGreaterThan(0);
      expect(d.tom.length).toBeGreaterThan(0);
    }
  });
});
