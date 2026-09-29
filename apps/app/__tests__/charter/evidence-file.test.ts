import { describe, expect, it } from "vitest";
import { isTenantFileKey } from "@/lib/charter/case-controls";
import {
  evidenceFileKey,
  evidenceFileName,
  evidenceMimeType,
  isEvidenceKeyOf,
  MAX_EVIDENCE_BYTES,
} from "@/lib/charter/evidence-file";

// A chave do arquivo de evidência é montada NO SERVIDOR e precisa passar no
// `isTenantFileKey` do backend do plano (só [A-Za-z0-9._-] por segmento, sem
// "." nem ".."). O nome vem do navegador: aqui ele é reduzido a esse alfabeto.

describe("evidenceFileName", () => {
  it("reduz ao alfabeto aceito pelo backend, mantendo a extensão", () => {
    expect(evidenceFileName("Relatório final (v2).PDF")).toBe(
      "Relat_rio_final__v2_.PDF"
    );
    expect(evidenceFileName("laudo rollback.pdf")).toBe("laudo_rollback.pdf");
  });

  it("nome hostil perde o caminho: só o último segmento fica", () => {
    expect(evidenceFileName("../../outro-tenant/x.pdf")).toBe("x.pdf");
    expect(evidenceFileName("..\\..\\x.pdf")).toBe("x.pdf");
  });

  it("nome vazio, '.' e '..' viram 'arquivo'", () => {
    for (const raw of ["", ".", "..", "   ", "///"]) {
      expect(evidenceFileName(raw)).toBe("arquivo");
    }
  });

  it("nome enorme é cortado sem perder a extensão", () => {
    const out = evidenceFileName(`${"a".repeat(300)}.pdf`);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});

describe("evidenceFileKey", () => {
  const base = {
    tenantId: "t1",
    caseCode: "UC-118",
    controlCode: "TR-2",
    version: 3,
    filename: "Relatório final.pdf",
  };

  it("<tenant>/charter/<caso>/<controle>/v<N>/<nome saneado>", () => {
    expect(evidenceFileKey(base)).toBe(
      "t1/charter/UC-118/TR-2/v3/Relat_rio_final.pdf"
    );
  });

  it("passa no isTenantFileKey do backend do plano", () => {
    expect(isTenantFileKey("t1", evidenceFileKey(base))).toBe(true);
  });

  it("código de caso/controle hostil não escapa do prefixo", () => {
    const key = evidenceFileKey({
      ...base,
      caseCode: "../t2",
      controlCode: "a/b",
    });
    expect(isTenantFileKey("t1", key)).toBe(true);
    expect(key.startsWith("t1/charter/")).toBe(true);
    expect(key.split("/")).not.toContain("..");
  });

  it("isEvidenceKeyOf reconhece só a chave do próprio caso e controle", () => {
    const key = evidenceFileKey(base);
    expect(isEvidenceKeyOf(key, base)).toBe(true);
    expect(isEvidenceKeyOf(key, { ...base, controlCode: "TR-3" })).toBe(false);
    expect(isEvidenceKeyOf(key, { ...base, tenantId: "t2" })).toBe(false);
  });
});

describe("evidenceMimeType — lista de permissão por extensão", () => {
  it("aceita tipos de evidência e devolve o canônico", () => {
    expect(evidenceMimeType("laudo.pdf")).toBe("application/pdf");
    expect(evidenceMimeType("PRINT.PNG")).toBe("image/png");
    expect(evidenceMimeType("dados.csv")).toBe("text/csv");
  });

  it("recusa executável, html e script", () => {
    for (const n of ["a.exe", "a.html", "a.js", "a.svg", "a.sh", "semext"]) {
      expect(evidenceMimeType(n)).toBeNull();
    }
  });

  it("só vale a ÚLTIMA extensão: a.pdf.exe é exe", () => {
    expect(evidenceMimeType("a.pdf.exe")).toBeNull();
  });

  it("tamanho máximo de 10 MB", () => {
    expect(MAX_EVIDENCE_BYTES).toBe(10 * 1024 * 1024);
  });
});
