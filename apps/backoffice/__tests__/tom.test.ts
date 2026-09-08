// tom.test.ts — `tomCss` (C4) é exatamente a classe de bug que já subiu para
// produção uma vez no funil: "neutral" sem variável de cor própria no kit
// (`var(--neutral)` não existe) precisa cair no azul; os demais tons passam
// direto.
import { describe, expect, it } from "vitest";
import { tomCss } from "@/lib/tom";

describe("tomCss", () => {
  it("mapeia neutral para blue", () => {
    expect(tomCss("neutral")).toBe("blue");
  });

  it("passa os demais tons direto", () => {
    expect(tomCss("blue")).toBe("blue");
    expect(tomCss("amber")).toBe("amber");
    expect(tomCss("accent")).toBe("accent");
    expect(tomCss("purple")).toBe("purple");
    expect(tomCss("green")).toBe("green");
    expect(tomCss("red")).toBe("red");
  });
});
