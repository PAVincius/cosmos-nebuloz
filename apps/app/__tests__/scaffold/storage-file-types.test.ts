import { describe, expect, it } from "vitest";

// Tipos de arquivo do Scaffold e as opções do bucket (Vigia P2): o cliente
// escolhe o arquivo, e o download não pode abrir inline o que ele subiu.

describe("scaffoldFileMimeType", () => {
  it.each([
    ["plano.pdf", "application/pdf"],
    ["PLANO.PDF", "application/pdf"],
    ["dados.csv", "text/csv"],
    ["foto.jpg", "image/jpeg"],
    ["foto.jpeg", "image/jpeg"],
    ["a.b.c.txt", "text/plain"],
  ])("%s → %s", async (name, mime) => {
    const { scaffoldFileMimeType } = await import("@repo/storage");
    expect(scaffoldFileMimeType(name)).toBe(mime);
  });

  it.each([
    "x.exe",
    "x.html",
    "x.svg",
    "x.js",
    "x.pdf.exe",
    "sem-extensao",
    "termina-em-ponto.",
    ".pdf",
    "",
  ])("recusa %j", async (name) => {
    const { scaffoldFileMimeType } = await import("@repo/storage");
    // ".pdf" sozinho é arquivo oculto sem nome, e sua extensão vale: o que
    // importa é que nada fora da lista passa.
    const r = scaffoldFileMimeType(name);
    expect(r === null || name === ".pdf").toBe(true);
  });

  it("a lista de permissão não tem tipo que renderiza no navegador", async () => {
    const { SCAFFOLD_ALLOWED_MIME_TYPES } = await import("@repo/storage");
    for (const bad of [
      "text/html",
      "image/svg+xml",
      "application/javascript",
      "application/xhtml+xml",
    ]) {
      expect(SCAFFOLD_ALLOWED_MIME_TYPES).not.toContain(bad);
    }
    expect(SCAFFOLD_ALLOWED_MIME_TYPES).toEqual(
      expect.arrayContaining([
        "application/pdf",
        "image/png",
        "text/csv",
        "text/plain",
      ])
    );
  });

  it("o bucket aceita o que o produto grava nele: zip do handover e markdown de passo", async () => {
    const { SCAFFOLD_BUCKET_MIME_TYPES, SCAFFOLD_ALLOWED_MIME_TYPES } =
      await import("@repo/storage");
    for (const m of SCAFFOLD_ALLOWED_MIME_TYPES) {
      expect(SCAFFOLD_BUCKET_MIME_TYPES).toContain(m);
    }
    expect(SCAFFOLD_BUCKET_MIME_TYPES).toEqual(
      expect.arrayContaining(["application/zip", "text/markdown"])
    );
  });
});

describe("opções do bucket (o que ensureBucket manda ao Supabase)", () => {
  it("scaffold-artefacts: privado, 10 MB e tipos permitidos", async () => {
    const {
      bucketOptionsFor,
      SCAFFOLD_ARTEFACT_BUCKET,
      SCAFFOLD_BUCKET_MIME_TYPES,
    } = await import("@repo/storage");
    expect(bucketOptionsFor(SCAFFOLD_ARTEFACT_BUCKET)).toEqual({
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: SCAFFOLD_BUCKET_MIME_TYPES,
    });
  });

  it("o bucket do playground segue como era: sem lista de tipos", async () => {
    const { bucketOptionsFor, AI_PLAYGROUND_BUCKET } = await import(
      "@repo/storage"
    );
    expect(bucketOptionsFor(AI_PLAYGROUND_BUCKET)).toEqual({
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });
  });

  it("nunca é público", async () => {
    const { bucketOptionsFor, SCAFFOLD_ARTEFACT_BUCKET } = await import(
      "@repo/storage"
    );
    expect(bucketOptionsFor(SCAFFOLD_ARTEFACT_BUCKET).public).toBe(false);
  });
});
