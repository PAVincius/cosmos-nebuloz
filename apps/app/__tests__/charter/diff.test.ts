// Diff de texto do Charter. O que este teste protege é o artefato central do
// produto: o auditor abre o diff de versão para ver *o que* mudou. A versão
// anterior recortava 180 caracteres de cada lado, então uma mudança no terceiro
// parágrafo virava dois blocos idênticos — o diff mentia por omissão.
//
// Casos reais, texto de política real: seção é parágrafo corrido, não código.
// É por isso que o caso "uma linha só, uma palavra mudada" é o mais importante
// daqui — sem o recuo para diff por palavra, o diff por linha degenera em
// "tudo mudou" e volta a não dizer nada.

import { describe, expect, it } from "vitest";
import { agruparSegmentos, diffTexto } from "@/lib/charter/diff";

const mudancas = (segs: { tipo: string }[]) =>
  segs.filter((s) => s.tipo !== "igual");

describe("diffTexto — diff por linha", () => {
  it("texto idêntico não produz nenhum segmento de mudança", () => {
    const r = diffTexto(
      "Uso permitido.\n\nRevisão humana.",
      "Uso permitido.\n\nRevisão humana."
    );

    expect(mudancas(r.segmentos)).toEqual([]);
    expect(r.truncado).toBe(false);
    expect(r.linhasOmitidas).toBe(0);
  });

  it("mudança só no 3º parágrafo mantém os outros como iguais", () => {
    const antes = [
      "Parágrafo um.",
      "",
      "Parágrafo dois.",
      "",
      "Parágrafo três.",
      "",
      "Parágrafo quatro.",
    ].join("\n");
    const depois = [
      "Parágrafo um.",
      "",
      "Parágrafo dois.",
      "",
      "Parágrafo TRÊS revisado.",
      "",
      "Parágrafo quatro.",
    ].join("\n");

    const r = diffTexto(antes, depois);

    expect(mudancas(r.segmentos)).toEqual([
      { tipo: "removida", texto: "Parágrafo três.", linhaAntes: 5 },
      { tipo: "adicionada", texto: "Parágrafo TRÊS revisado.", linhaDepois: 5 },
    ]);
    expect(r.segmentos.filter((s) => s.tipo === "igual")).toHaveLength(6);
  });

  it("linha adicionada no fim aparece só como adicionada", () => {
    const r = diffTexto("a\nb", "a\nb\nc");

    expect(mudancas(r.segmentos)).toEqual([
      { tipo: "adicionada", texto: "c", linhaDepois: 3 },
    ]);
  });

  it("linha removida do início aparece só como removida", () => {
    const r = diffTexto("a\nb\nc", "b\nc");

    expect(mudancas(r.segmentos)).toEqual([
      { tipo: "removida", texto: "a", linhaAntes: 1 },
    ]);
  });

  it("lado vazio não vira linha em branco fantasma", () => {
    const r = diffTexto("", "a\nb");

    expect(r.segmentos).toEqual([
      { tipo: "adicionada", texto: "a", linhaDepois: 1 },
      { tipo: "adicionada", texto: "b", linhaDepois: 2 },
    ]);
  });

  it("CRLF e LF do mesmo texto não são diferença", () => {
    const r = diffTexto("a\r\nb\r\nc", "a\nb\nc");

    expect(mudancas(r.segmentos)).toEqual([]);
    expect(r.segmentos.some((s) => s.texto.includes("\r"))).toBe(false);
  });

  it("recorta com contagem explícita em vez de truncar calado", () => {
    const gigante = Array.from({ length: 2600 }, (_, i) => `linha ${i}`).join(
      "\n"
    );

    const r = diffTexto(gigante, gigante);

    expect(r.truncado).toBe(true);
    expect(r.linhasOmitidas).toBe(1200);
  });
});

describe("diffTexto — recuo para diff por palavra em linha longa", () => {
  const LONGA_ANTES =
    "O fornecedor deve manter registro de todas as inferências do modelo por prazo não inferior a vinte e quatro meses contados da data da decisão automatizada.";
  const LONGA_DEPOIS =
    "O fornecedor deve manter registro de todas as inferências do modelo por prazo não inferior a trinta e seis meses contados da data da decisão automatizada.";

  it("uma linha só, uma palavra mudada: as partes iguais continuam iguais", () => {
    const r = diffTexto(LONGA_ANTES, LONGA_DEPOIS);

    const removida = r.segmentos.find((s) => s.tipo === "removida");
    const adicionada = r.segmentos.find((s) => s.tipo === "adicionada");

    expect(removida?.partes).toBeDefined();
    expect(adicionada?.partes).toBeDefined();
    expect(removida?.partes?.some((p) => p.tipo === "igual")).toBe(true);
    expect(
      removida?.partes?.some(
        (p) => p.tipo === "removida" && p.texto.includes("vinte")
      )
    ).toBe(true);
    expect(
      adicionada?.partes?.some(
        (p) => p.tipo === "adicionada" && p.texto.includes("trinta")
      )
    ).toBe(true);
  });

  it("as partes remontam a linha inteira — nada se perde no caminho", () => {
    const r = diffTexto(LONGA_ANTES, LONGA_DEPOIS);

    const removida = r.segmentos.find((s) => s.tipo === "removida");
    const adicionada = r.segmentos.find((s) => s.tipo === "adicionada");

    expect(removida?.partes?.map((p) => p.texto).join("")).toBe(LONGA_ANTES);
    expect(adicionada?.partes?.map((p) => p.texto).join("")).toBe(LONGA_DEPOIS);
  });

  it("linha curta reescrita não ganha partes — o par já diz tudo", () => {
    const r = diffTexto("Uso aceitável", "Uso vedado");

    expect(
      r.segmentos.find((s) => s.tipo === "removida")?.partes
    ).toBeUndefined();
    expect(
      r.segmentos.find((s) => s.tipo === "adicionada")?.partes
    ).toBeUndefined();
  });
});

describe("agruparSegmentos", () => {
  const antes = Array.from({ length: 20 }, (_, i) => `linha ${i + 1}`).join(
    "\n"
  );
  const depois = antes.replace("linha 10", "linha 10 revisada");

  it("colapsa o trecho inalterado longe da mudança com a contagem", () => {
    const blocos = agruparSegmentos(diffTexto(antes, depois).segmentos, 2);

    const colapsados = blocos.filter((b) => b.tipo === "colapsado");
    expect(colapsados).toHaveLength(2);
    expect(colapsados.map((b) => b.linhas)).toEqual([7, 8]);
  });

  it("mantém o contexto pedido ao redor da mudança", () => {
    const blocos = agruparSegmentos(diffTexto(antes, depois).segmentos, 2);

    const mudanca = blocos.find((b) => b.tipo === "mudanca");
    expect(mudanca?.segmentos.map((s) => s.texto)).toEqual([
      "linha 8",
      "linha 9",
      "linha 10",
      "linha 10 revisada",
      "linha 11",
      "linha 12",
    ]);
  });

  it("não colapsa o que cabe inteiro no contexto", () => {
    const blocos = agruparSegmentos(diffTexto("a\nb", "a\nB").segmentos, 2);

    expect(blocos.every((b) => b.tipo === "mudanca")).toBe(true);
  });

  it("nenhum segmento se perde no agrupamento", () => {
    const segs = diffTexto(antes, depois).segmentos;
    const blocos = agruparSegmentos(segs, 2);

    expect(blocos.flatMap((b) => b.segmentos)).toEqual(segs);
  });
});
