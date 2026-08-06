import { describe, expect, it } from "vitest";
// CORPORA mora em regulacao-corpora.ts (não em seed-regulacao.mts): um
// specifier terminado em ".mts" só typecheca com allowImportingTsExtensions,
// que este projeto não liga; ".ts" sem extensão resolve normalmente sob
// "moduleResolution": "Bundler" (mesmo padrão de packages/rbac/src/matrix).
import { CORPORA } from "../../../../packages/database/scripts/regulacao-corpora";

describe("guarda de copyright dos corpora", () => {
  // ISO/IEC 42001 é norma proprietária: reproduzir o texto das cláusulas é
  // infração. Isso não pode depender de alguém lembrar no code review, nem do
  // próximo que for cadastrar um conjunto novo.
  it("nenhum conjunto REFERENCIA traz texto verbatim", () => {
    for (const corpus of CORPORA) {
      if (corpus.licenca !== "REFERENCIA") {
        continue;
      }
      for (const req of corpus.requisitos) {
        expect(
          req.texto,
          `${corpus.nome} · ${req.codigo} não pode reproduzir texto`
        ).toBeUndefined();
      }
    }
  });

  it("todo requisito tem citação e resumo, independente da licença", () => {
    for (const corpus of CORPORA) {
      for (const req of corpus.requisitos) {
        expect(req.citacao.length).toBeGreaterThan(0);
        expect(req.resumo.length).toBeGreaterThan(0);
      }
    }
  });

  it("ISO/IEC 42001 está marcada como REFERENCIA", () => {
    const iso = CORPORA.find((c) => c.nome.includes("42001"));
    expect(iso?.licenca).toBe("REFERENCIA");
  });
});
