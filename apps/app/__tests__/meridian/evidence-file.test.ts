// @vitest-environment node

import {
  type BucketAdmin,
  bucketOptionsFor,
  ensureBucketWith,
  MERIDIAN_EVIDENCE_BUCKET,
  MERIDIAN_EVIDENCE_MIME_TYPES,
  meridianEvidenceMimeType,
} from "@repo/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sniffEvidence } from "@/lib/meridian/evidence-file";

// Achado 18a do Lacre (MÉDIO): o upload de evidência não tinha allowlist de tipo
// e o arquivo era servido inline. O respondente não tem conta, então o arquivo é
// de um estranho: só entra o que é documento ou imagem, o tipo vem da extensão e
// os primeiros bytes têm de confirmar, e o bucket repete a lista (segunda linha).

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe("meridianEvidenceMimeType (extensão → tipo)", () => {
  it.each([
    ["plano.pdf", "application/pdf"],
    ["PLANO.PDF", "application/pdf"],
    ["foto.jpg", "image/jpeg"],
    ["foto.jpeg", "image/jpeg"],
    ["print.png", "image/png"],
    ["dados.csv", "text/csv"],
    ["nota.txt", "text/plain"],
    ["a.b.c.txt", "text/plain"],
    [
      "ata.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  ])("%s → %s", (name, mime) => {
    expect(meridianEvidenceMimeType(name)).toBe(mime);
  });

  it.each([
    "x.exe",
    "x.html",
    "x.htm",
    "x.svg",
    "x.js",
    "x.sh",
    "x.zip",
    "x.pdf.exe",
    "sem-extensao",
    "termina-em-ponto.",
    "",
  ])("recusa %j", (name) => {
    expect(meridianEvidenceMimeType(name)).toBeNull();
  });

  it("a lista não tem tipo que o navegador renderiza ou executa", () => {
    for (const bad of [
      "text/html",
      "image/svg+xml",
      "application/javascript",
      "application/xhtml+xml",
      "application/x-msdownload",
    ]) {
      expect(MERIDIAN_EVIDENCE_MIME_TYPES).not.toContain(bad);
    }
  });
});

describe("sniffEvidence (os primeiros bytes confirmam o tipo)", () => {
  it("PDF com %PDF-, PNG com a assinatura PNG, JPEG com FFD8FF", () => {
    expect(sniffEvidence("a.pdf", ascii("%PDF-1.7\n..."))).toBe(
      "application/pdf"
    );
    expect(
      sniffEvidence(
        "a.png",
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
      )
    ).toBe("image/png");
    expect(sniffEvidence("a.jpg", bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe(
      "image/jpeg"
    );
  });

  it("DOCX, XLSX e PPTX são contêineres ZIP (PK\\x03\\x04)", () => {
    for (const n of ["a.docx", "a.xlsx", "a.pptx"]) {
      expect(
        sniffEvidence(n, bytes(0x50, 0x4b, 0x03, 0x04, 0x14))
      ).not.toBeNull();
    }
  });

  it("texto e CSV: UTF-8 sem byte nulo", () => {
    expect(sniffEvidence("a.txt", ascii("olá, evidência\n"))).toBe(
      "text/plain"
    );
    expect(sniffEvidence("a.csv", ascii("a,b\n1,2\n"))).toBe("text/csv");
  });

  it("executável renomeado para .pdf é recusado (MZ no lugar de %PDF-)", () => {
    expect(
      sniffEvidence("relatorio.pdf", bytes(0x4d, 0x5a, 0x90, 0x00))
    ).toBeNull();
  });

  it("HTML com extensão .png é recusado", () => {
    expect(
      sniffEvidence("a.png", ascii("<html><script>x</script>"))
    ).toBeNull();
  });

  it(".docx que não é ZIP é recusado", () => {
    expect(sniffEvidence("a.docx", ascii("%PDF-1.7"))).toBeNull();
  });

  it(".txt com byte nulo (binário) é recusado", () => {
    expect(sniffEvidence("a.txt", bytes(0x68, 0x69, 0x00, 0x01))).toBeNull();
  });

  it("extensão fora da lista é recusada mesmo com bytes bons", () => {
    expect(sniffEvidence("a.exe", ascii("%PDF-1.7"))).toBeNull();
  });

  it("arquivo vazio é recusado", () => {
    expect(sniffEvidence("a.pdf", new Uint8Array())).toBeNull();
  });
});

describe("bucket meridian-evidence (segunda linha)", () => {
  it("nasce privado, com 10 MB e a mesma lista de tipos", () => {
    expect(bucketOptionsFor(MERIDIAN_EVIDENCE_BUCKET)).toEqual({
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: MERIDIAN_EVIDENCE_MIME_TYPES,
    });
  });

  describe("bucket que já existe sem a lista", () => {
    const h = {
      listBuckets: vi.fn(),
      createBucket: vi.fn(),
      updateBucket: vi.fn(),
    };
    const client = { storage: h } as unknown as BucketAdmin;

    beforeEach(() => {
      vi.clearAllMocks();
      h.listBuckets.mockResolvedValue({
        data: [{ name: MERIDIAN_EVIDENCE_BUCKET }],
        error: null,
      });
      h.updateBucket.mockResolvedValue({ data: {}, error: null });
    });

    it("reaplica a lista no primeiro uso, como o bucket do Scaffold", async () => {
      await ensureBucketWith(client, MERIDIAN_EVIDENCE_BUCKET);
      expect(h.createBucket).not.toHaveBeenCalled();
      expect(h.updateBucket).toHaveBeenCalledWith(
        MERIDIAN_EVIDENCE_BUCKET,
        expect.objectContaining({
          allowedMimeTypes: MERIDIAN_EVIDENCE_MIME_TYPES,
        })
      );
    });
  });
});
