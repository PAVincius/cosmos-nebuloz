import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AdoptionSparkline,
  OutcomeSparkline,
  RoiSparkline,
  Sparkline,
} from "@/components/signal/charts";

// Sparkline — SVG puro, sem biblioteca.
//
// O que estes testes protegem não é aparência: é que a escala relativa não
// minta, que série curta demais não vire "tendência", e que a direção esteja
// disponível em texto para quem não distingue as cores.

const points = (svg: Element | null) =>
  svg?.querySelector("polyline")?.getAttribute("points") ?? "";

const parse = (attr: string) =>
  attr
    .trim()
    .split(" ")
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x: x as number, y: y as number };
    });

describe("série curta", () => {
  it("um único ponto NÃO é tendência — não desenha", () => {
    // Desenhar um ponto solto sugeriria série onde há uma medição.
    render(<Sparkline ariaLabel="teste" values={[42]} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/série ainda curta/i)).toBeDefined();
  });

  it("série vazia também não desenha", () => {
    render(<Sparkline ariaLabel="teste" values={[]} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("dois pontos já formam tendência", () => {
    render(<Sparkline ariaLabel="teste" values={[10, 20]} />);
    expect(screen.getByRole("img")).toBeDefined();
  });
});

describe("escala", () => {
  it("é relativa à própria série, não a zero", () => {
    // Adoção entre 71% e 78% viraria uma reta num eixo que começa em zero — e é
    // justamente a variação que interessa.
    const { container } = render(
      <Sparkline ariaLabel="t" height={36} values={[71, 74, 78]} width={100} />
    );
    const ys = parse(points(container.querySelector("svg"))).map((p) => p.y);
    // O menor valor encosta na base útil e o maior no topo: amplitude cheia.
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20);
  });

  it("série achatada não quebra (divisão por zero)", () => {
    const { container } = render(
      <Sparkline ariaLabel="t" values={[50, 50, 50]} />
    );
    const ys = parse(points(container.querySelector("svg"))).map((p) => p.y);
    expect(ys.every((y) => Number.isFinite(y))).toBe(true);
    expect(new Set(ys).size).toBe(1);
  });

  it("SVG cresce para baixo: valor maior tem y MENOR", () => {
    const { container } = render(<Sparkline ariaLabel="t" values={[10, 90]} />);
    const [first, last] = parse(points(container.querySelector("svg")));
    expect((last as { y: number }).y).toBeLessThan((first as { y: number }).y);
  });

  it("a régua entra no domínio para não sair do desenho", () => {
    // Série inteira acima da régua: sem incluí-la, a linha tracejada cairia
    // fora da área visível.
    const { container } = render(
      <Sparkline ariaLabel="t" threshold={1} values={[3, 4, 5]} />
    );
    const line = container.querySelector("line");
    const y = Number(line?.getAttribute("y1"));
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(36);
  });
});

describe("acessibilidade", () => {
  it("tem rótulo acessível", () => {
    render(<Sparkline ariaLabel="Evolução da adoção" values={[1, 2]} />);
    expect(screen.getByLabelText("Evolução da adoção")).toBeDefined();
  });

  it("a direção também vai em TEXTO — cor sozinha não comunica", () => {
    render(<Sparkline ariaLabel="t" values={[10, 20]} />);
    expect(screen.getByText("Série em alta")).toBeDefined();
  });

  it("série em queda diz que está em queda", () => {
    render(<Sparkline ariaLabel="t" values={[20, 10]} />);
    expect(screen.getByText("Série em queda")).toBeDefined();
  });
});

describe("variantes de domínio", () => {
  it("adoção usa a régua do tenant como referência", () => {
    const { container } = render(
      <AdoptionSparkline adoptionBar={60} values={[40, 55, 78]} />
    );
    expect(container.querySelector("line")).not.toBeNull();
  });

  it("ROI usa o break-even (1,0×) como referência, não a régua de escala", () => {
    // Abaixo de 1,0× a iniciativa custa mais do que devolve. Essa é a linha que
    // precisa estar visível no desenho, mesmo quando a régua do tenant é 1,5×.
    const { container } = render(<RoiSparkline values={[0.2, 0.6, 0.9]} />);
    expect(container.querySelector("line")).not.toBeNull();
  });

  it("resultado lê a direção da métrica para decidir o que é melhora", () => {
    // Mesma série, direções opostas, tons opostos.
    const down = render(
      <OutcomeSparkline direction="LOWER_IS_BETTER" values={[46, 31]} />
    );
    expect(down.getByText("Série em queda")).toBeDefined();
    down.unmount();

    const up = render(
      <OutcomeSparkline direction="HIGHER_IS_BETTER" values={[46, 31]} />
    );
    expect(up.getByText("Série em queda")).toBeDefined();
  });
});
