import { describe, expect, it } from "vitest";
import { safeFileName } from "@/lib/scaffold/file-name";

// O nome do arquivo entra na chave do objeto no storage. Sem isto, "../" no
// nome sairia do prefixo do tenant: o prefixo é a segunda linha de defesa do
// bucket privado.

describe("safeFileName", () => {
  it("mantém um nome normal, com acento e espaço", () => {
    expect(safeFileName("Plano de rollback (v2).pdf")).toBe(
      "Plano de rollback (v2).pdf"
    );
    expect(safeFileName("relatório-final.xlsx")).toBe("relatório-final.xlsx");
  });

  it.each([
    ["../../outro-tenant/segredo.pdf", "segredo.pdf"],
    ["a/b/c.txt", "c.txt"],
    ["C:\\Users\\x\\doc.docx", "doc.docx"],
    ["/etc/passwd", "passwd"],
  ])("fica só com o último segmento: %s", (input, expected) => {
    expect(safeFileName(input)).toBe(expected);
  });

  it("nunca devolve ponto-ponto nem nome vazio", () => {
    for (const bad of ["..", ".", "", "   ", "../", "/", "\\"]) {
      const out = safeFileName(bad);
      expect(out).not.toContain("/");
      expect(out).not.toBe("..");
      expect(out).not.toBe(".");
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it("troca caractere de controle e separador escondido", () => {
    expect(safeFileName("a\u0000b\nc.pdf")).toBe("a_b_c.pdf");
    expect(safeFileName("nome?com#símbolos.pdf")).not.toMatch(/[?#]/);
  });

  it("limita o tamanho, preservando a extensão", () => {
    const out = safeFileName(`${"x".repeat(300)}.pdf`);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});
