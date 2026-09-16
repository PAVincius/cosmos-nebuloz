import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValueReading } from "@/components/signal/verdict-badge";

// Teste NORMATIVO das regras de conteúdo (`contracts/ui-contract.md` §6).
//
// Não é teste de aparência: é o que impede a regra-mãe do produto de ser
// quebrada por descuido de composição. O protótipo já mostrava o múltiplo cru
// na lista, sem versão nem confiança — este arquivo existe para que isso volte
// como falha de teste, não como bug em produção.

const PROVEN = {
  multiple: 4.2,
  formulaVersion: 3,
  confidenceScore: 93,
  confidenceBand: "HIGH",
  adoptionPct: 77.8,
  verdictLabel: "Provado",
  verdictTone: "green",
  verdictAction: "Escalar orçamento",
};

describe("regra 1 — ROI nunca aparece sozinho", () => {
  it("exibe a versão da fórmula ao lado do múltiplo", () => {
    render(<ValueReading {...PROVEN} />);
    expect(screen.getByText("4,2×")).toBeDefined();
    expect(screen.getByText(/fórmula v3/)).toBeDefined();
  });

  it("exibe o score de confiança no mesmo bloco", () => {
    render(<ValueReading {...PROVEN} />);
    expect(screen.getByText(/confiança 93/)).toBeDefined();
  });

  it("mantém os três juntos também na variante compacta da lista", () => {
    // A lista foi exatamente onde o protótipo errou.
    render(<ValueReading {...PROVEN} compact />);
    expect(screen.getByText("4,2×")).toBeDefined();
    expect(screen.getByText(/fórmula v3/)).toBeDefined();
    expect(screen.getByText(/confiança 93/)).toBeDefined();
  });
});

describe("regra 2 — adoção e resultado moram juntos", () => {
  it("exibe adoção no mesmo bloco do retorno", () => {
    render(<ValueReading {...PROVEN} />);
    expect(screen.getByText(/adoção 78%/)).toBeDefined();
  });
});

describe("regra 6 — veredito precede a métrica", () => {
  it("exibe o rótulo do veredito e a ação sugerida", () => {
    render(<ValueReading {...PROVEN} />);
    expect(screen.getByText("Provado")).toBeDefined();
    expect(screen.getByText("Escalar orçamento")).toBeDefined();
  });
});

describe("estado sem lastro", () => {
  it("com confiança zero, o múltiplo é EXIBIDO e marcado, não escondido", () => {
    // Esconder faria a iniciativa parecer não medida, quando ela foi medida
    // mal. A diferença importa para quem decide.
    const { container } = render(
      <ValueReading
        {...PROVEN}
        confidenceBand="NONE"
        confidenceScore={0}
        verdictLabel="Candidata a parada"
        verdictTone="neutral"
      />
    );
    expect(screen.getByText("4,2×")).toBeDefined();
    expect(screen.getByText("sem lastro")).toBeDefined();
    const value = container.querySelector('[style*="line-through"]');
    expect(value).not.toBeNull();
  });

  it("sem fórmula versionada também conta como sem lastro", () => {
    render(<ValueReading {...PROVEN} formulaVersion={null} />);
    expect(screen.getByText("sem lastro")).toBeDefined();
    // E nunca inventa uma versão para preencher o espaço.
    expect(screen.queryByText(/fórmula v/)).toBeNull();
  });

  it("sem lastro não há veredito — o badge diz o que falta", () => {
    // "Candidata a parada" para um rascunho que ainda nem lançou a primeira
    // linha da conta é acusação, não leitura.
    render(
      <ValueReading
        {...PROVEN}
        formulaVersion={null}
        verdictAction="Escalar"
        verdictLabel="Candidata a parada"
        verdictTone="neutral"
      />
    );
    expect(screen.getByText("Sem veredito")).toBeDefined();
    expect(screen.queryByText("Candidata a parada")).toBeNull();
    expect(screen.getByText(/assinar o baseline/i)).toBeDefined();
  });

  it("múltiplo nulo vira travessão, nunca 0,0×", () => {
    render(<ValueReading {...PROVEN} formulaVersion={null} multiple={null} />);
    expect(screen.getByText("—")).toBeDefined();
    expect(screen.queryByText("0,0×")).toBeNull();
  });
});

describe("faixa de confiança", () => {
  it.each([
    ["HIGH", "Alta"],
    ["MEDIUM", "Média"],
    ["LOW", "Baixa"],
    ["NONE", "Sem dado"],
  ])("traduz a faixa %s para %s", (band, label) => {
    render(
      <ValueReading
        {...PROVEN}
        confidenceBand={band}
        confidenceScore={band === "NONE" ? 0 : 70}
      />
    );
    expect(screen.getByText(new RegExp(label))).toBeDefined();
  });
});
