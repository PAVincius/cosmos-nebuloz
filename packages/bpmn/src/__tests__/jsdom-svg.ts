/**
 * O jsdom não implementa geometria SVG (getBBox, SVGMatrix, transform.baseVal)
 * nem canvas 2D, e o diagram-js usa os três para posicionar e medir. Sem a
 * medida de texto, o laço que quebra rótulo em linhas nunca termina — o teste
 * trava em vez de falhar. Estes stubs devolvem identidade e larguras
 * proporcionais: o teste confere o que o bpmn-js importa e desenha (quais
 * elementos, quais avisos), não o pixel.
 */

type Coeficientes = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

const IDENTIDADE: Coeficientes = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Faz o papel de SVGMatrix; `instanceof SVGMatrix` do tiny-svg precisa dela. */
class MatrizFalsa {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;

  constructor(m: Coeficientes = IDENTIDADE) {
    this.a = m.a;
    this.b = m.b;
    this.c = m.c;
    this.d = m.d;
    this.e = m.e;
    this.f = m.f;
  }

  multiply(m: Coeficientes): MatrizFalsa {
    return new MatrizFalsa({
      a: this.a * m.a + this.c * m.b,
      b: this.b * m.a + this.d * m.b,
      c: this.a * m.c + this.c * m.d,
      d: this.b * m.c + this.d * m.d,
      e: this.a * m.e + this.c * m.f + this.e,
      f: this.b * m.e + this.d * m.f + this.f,
    });
  }

  inverse(): MatrizFalsa {
    return new MatrizFalsa();
  }

  translate(x: number, y: number): MatrizFalsa {
    return new MatrizFalsa({ ...this, e: this.e + x, f: this.f + y });
  }

  scale(s: number): MatrizFalsa {
    return new MatrizFalsa({ ...this, a: this.a * s, d: this.d * s });
  }
}

class TransformacaoFalsa {
  type = 1;
  matrix: MatrizFalsa;

  constructor(m: MatrizFalsa = new MatrizFalsa()) {
    this.matrix = m;
  }

  setMatrix(m: MatrizFalsa): void {
    this.matrix = m;
  }

  setTranslate(x: number, y: number): void {
    this.matrix = new MatrizFalsa({ ...IDENTIDADE, e: x, f: y });
  }

  setScale(s: number): void {
    this.matrix = new MatrizFalsa({ ...IDENTIDADE, a: s, d: s });
  }

  setRotate(): void {
    // Sem uso no import.
  }
}

function listaDeTransformacoes() {
  const itens: TransformacaoFalsa[] = [];
  return {
    get numberOfItems() {
      return itens.length;
    },
    clear: () => {
      itens.length = 0;
    },
    appendItem: (t: TransformacaoFalsa) => itens.push(t),
    initialize: (t: TransformacaoFalsa) => {
      itens.length = 0;
      itens.push(t);
      return t;
    },
    consolidate: () => itens[0] ?? null,
    getItem: (i: number) => itens[i],
    createSVGTransformFromMatrix: (m: MatrizFalsa) => new TransformacaoFalsa(m),
  };
}

function medirTextoNoCanvas(): void {
  (
    window.HTMLCanvasElement.prototype as unknown as Record<string, unknown>
  ).getContext = () => ({
    font: "",
    measureText: (texto: string) => ({
      width: texto.length * 6,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 3,
    }),
  });
}

export function prepararSvgDoJsdom(): void {
  medirTextoNoCanvas();
  (globalThis as Record<string, unknown>).SVGMatrix = MatrizFalsa;

  const proto = window.SVGElement.prototype as unknown as Record<
    string,
    unknown
  >;
  proto.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
  proto.getComputedTextLength = () => 0;
  proto.getScreenCTM = () => new MatrizFalsa();
  proto.getCTM = () => new MatrizFalsa();

  const svg = window.SVGSVGElement.prototype as unknown as Record<
    string,
    unknown
  >;
  svg.createSVGMatrix = () => new MatrizFalsa();
  svg.createSVGTransform = () => new TransformacaoFalsa();
  svg.createSVGTransformFromMatrix = (m: MatrizFalsa) =>
    new TransformacaoFalsa(m);
  svg.createSVGPoint = () => ({
    x: 0,
    y: 0,
    matrixTransform: () => ({ x: 0, y: 0 }),
  });

  if (!("transform" in window.SVGElement.prototype)) {
    // Uma lista por elemento: o tiny-svg escreve e depois lê de volta.
    const listas = new WeakMap<object, { baseVal: unknown }>();
    Object.defineProperty(window.SVGElement.prototype, "transform", {
      get() {
        const existente = listas.get(this);
        if (existente) {
          return existente;
        }
        const nova = { baseVal: listaDeTransformacoes() };
        listas.set(this, nova);
        return nova;
      },
    });
  }
}

/** Importa no Viewer do bpmn-js e devolve os avisos e os ids desenhados. */
export async function abrirNoBpmnJs(
  xml: string
): Promise<{ avisos: string[]; ids: string[] }> {
  const { default: Viewer } = await import("bpmn-js/lib/Viewer");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const viewer = new Viewer({ container });
  try {
    const { warnings } = await viewer.importXML(xml);
    const registro = viewer.get("elementRegistry") as {
      getAll: () => { id: string; type: string }[];
    };
    return {
      avisos: warnings.map((w: { message: string }) => w.message),
      ids: registro
        .getAll()
        .filter((e) => e.type !== "label")
        .map((e) => e.id),
    };
  } finally {
    viewer.destroy();
    container.remove();
  }
}
