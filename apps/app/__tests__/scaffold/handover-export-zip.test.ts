import { beforeEach, describe, expect, it, vi } from "vitest";

// exportHandoverPack monta o ZIP com os artefatos EMBUTIDOS. O nome de cada um
// vem do navegador de quem anexou, e o pacote é extraído fora do nosso
// controle: aqui se prova que o caminho de cada entrada do ZIP é o do manifesto
// seguro, nunca o nome cru (zip-slip).

const h = vi.hoisted(() => ({
  entries: null as Record<string, Uint8Array> | null,
  downloaded: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("fflate", () => ({
  zipSync: (entries: Record<string, Uint8Array>) => {
    h.entries = entries;
    return new Uint8Array([1]);
  },
}));
vi.mock("@/lib/scaffold/guards", () => ({
  requireScaffoldPermissionContext: async () => ({
    tenantId: "t1",
    userId: "u1",
    role: "ADMIN",
    scaffoldRole: "CONSULTANT",
    user: { name: "Marina", email: "m@x.com" },
  }),
}));
vi.mock("@repo/storage", () => ({
  SCAFFOLD_ARTEFACT_BUCKET: "scaffold-artefacts",
  storageClient: {
    storage: {
      from: () => ({
        download: async (key: string) => {
          h.downloaded.push(key);
          return {
            data: { arrayBuffer: async () => new ArrayBuffer(1) },
            error: null,
          };
        },
        upload: async () => ({ error: null }),
        createSignedUrl: async () => ({
          data: { signedUrl: "https://blob.example/h.zip" },
          error: null,
        }),
      }),
    },
  },
}));

const art = (filename: string, objectKey: string) => ({
  filename,
  objectKey,
  sizeBytes: 1,
  uploadedAt: new Date(),
});

vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({
      scaffoldTrack: {
        findFirst: async () => ({
          id: "trk1",
          code: "TR-104",
          processName: "Triagem",
          archetype: null,
          startedAt: new Date(),
          embeddedAt: new Date(),
          ownerId: null,
          consultantId: null,
          tenant: { name: "Vanta" },
          templateVersion: { label: "v1" },
          businessCase: null,
          phases: [
            {
              phase: "ASSESS",
              closedAt: new Date(),
              steps: [
                {
                  statement: "Passo",
                  expectedArtefact: "Artefato",
                  artefacts: [
                    art("../../../etc/cron.d/evil.csv", "t1/trk1/s1/a"),
                    art("relatorio.pdf", "t1/trk1/s1/b"),
                    art("outra/pasta/relatorio.pdf", "t1/trk1/s1/c"),
                  ],
                },
              ],
              results: [],
            },
            { phase: "PILOT", closedAt: null, steps: [], results: [] },
            { phase: "SCALE", closedAt: null, steps: [], results: [] },
            { phase: "EMBED", closedAt: new Date(), steps: [], results: [] },
          ],
        }),
      },
      user: { findMany: async () => [] },
      auditLog: { create: async () => ({}) },
    }),
}));

import { exportHandoverPack } from "@/app/(scaffold)/actions/export";

beforeEach(() => {
  h.entries = null;
  h.downloaded = [];
});

describe("exportHandoverPack — caminho das entradas do ZIP", () => {
  it("nenhuma entrada sai da pasta do pacote, e cada artefato vai para o caminho do manifesto", async () => {
    const res = await exportHandoverPack({
      trackId: "clx0000000000000000trk001",
    });
    expect(res.ok).toBe(true);
    const names = Object.keys(h.entries ?? {});
    expect(names.sort()).toEqual([
      "artefatos/ASSESS/evil.csv",
      "artefatos/ASSESS/relatorio (2).pdf",
      "artefatos/ASSESS/relatorio.pdf",
      "index.html",
    ]);
    for (const n of names) {
      expect(n).not.toContain("..");
      expect(n.startsWith("/")).toBe(false);
    }
  });

  it("cada conteúdo vai para o nome do SEU manifesto (a ordem não embaralha)", async () => {
    await exportHandoverPack({ trackId: "clx0000000000000000trk001" });
    expect(h.downloaded).toEqual([
      "t1/trk1/s1/a",
      "t1/trk1/s1/b",
      "t1/trk1/s1/c",
    ]);
  });
});
