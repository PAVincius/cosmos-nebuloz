import { beforeEach, describe, expect, it, vi } from "vitest";

// Envio do arquivo de evidência pelo navegador: pede a URL assinada, faz o PUT
// com o tipo CANÔNICO e devolve a chave montada pelo servidor.

const h = vi.hoisted(() => ({ request: vi.fn(), fetch: vi.fn() }));

vi.mock("@/app/(charter)/actions/control-files", () => ({
  requestControlEvidenceUpload: h.request,
}));

import { uploadEvidenceFile } from "@/components/charter/controls-upload";

const REF = { code: "UC-118", controlCode: "TR-2" };
const file = (name: string, type: string, size = 100) =>
  new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  h.request.mockResolvedValue({
    ok: true,
    data: {
      uploadUrl: "https://s/up?token=1",
      fileKey: "t1/charter/UC-118/TR-2/v1/laudo.pdf",
      fileName: "laudo.pdf",
      contentType: "application/pdf",
    },
  });
  h.fetch.mockResolvedValue({ ok: true, status: 200 });
});

describe("uploadEvidenceFile", () => {
  it("pede a URL com nome, tipo e tamanho; faz o PUT com o tipo canônico", async () => {
    const res = await uploadEvidenceFile(
      file("laudo.pdf", "application/pdf", 2048),
      REF
    );
    expect(h.request).toHaveBeenCalledWith({
      ...REF,
      filename: "laudo.pdf",
      contentType: "application/pdf",
      sizeBytes: 2048,
    });
    expect(h.fetch).toHaveBeenCalledWith(
      "https://s/up?token=1",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
      })
    );
    expect(res).toEqual({
      ok: true,
      data: {
        fileKey: "t1/charter/UC-118/TR-2/v1/laudo.pdf",
        fileName: "laudo.pdf",
      },
    });
  });

  it("navegador sem tipo: usa o da extensão", async () => {
    await uploadEvidenceFile(file("dados.csv", ""), REF);
    expect(h.request.mock.calls[0][0].contentType).toBe("text/csv");
  });

  it("recusa do servidor volta com a mensagem e sem PUT", async () => {
    h.request.mockResolvedValue({
      ok: false,
      error: "Tipo de arquivo não aceito",
    });
    const res = await uploadEvidenceFile(
      file("a.exe", "application/x-msdownload"),
      REF
    );
    expect(res).toEqual({ ok: false, error: "Tipo de arquivo não aceito" });
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("PUT que falha não devolve chave: nada aponta para arquivo inexistente", async () => {
    h.fetch.mockResolvedValue({ ok: false, status: 500 });
    const res = await uploadEvidenceFile(
      file("laudo.pdf", "application/pdf"),
      REF
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/500/);
  });

  it("rede caída no PUT também vira erro dito", async () => {
    h.fetch.mockRejectedValue(new Error("network"));
    const res = await uploadEvidenceFile(
      file("laudo.pdf", "application/pdf"),
      REF
    );
    expect(res.ok).toBe(false);
  });
});
