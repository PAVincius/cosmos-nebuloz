import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchBrazilAiLaws } from "@/lib/ai-law-tracker/client";

const API_KEY = "test-api-key";

function apiRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "uuid-internal-1",
    identifier: "br-lei-15123-2025",
    title: "Marco Legal da IA",
    record_type: "lei",
    in_force: true,
    official_url: "https://exemplo.gov.br/lei-15123",
    jurisdiction: { slug: "brazil", name: "Brazil" },
    status: "active",
    summary: "resumo",
    record_date: "2025-01-01",
    updated_at: "2025-01-02T00:00:00Z",
    source: "congresso",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status === 200,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchBrazilAiLaws — mapeamento de campos", () => {
  it("mapeia snake_case da API para os campos do tipo AiLawRecord", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [apiRecord()],
        meta: { count: 1, total: 1 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBrazilAiLaws(API_KEY);

    expect(result).toEqual([
      {
        identifier: "br-lei-15123-2025",
        title: "Marco Legal da IA",
        recordType: "lei",
        inForce: true,
        officialUrl: "https://exemplo.gov.br/lei-15123",
      },
    ]);
  });

  it("envia a X-API-Key e os parâmetros documentados na primeira página", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: [], meta: { count: 0, total: 0 } })
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchBrazilAiLaws(API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      "https://ai-law-tracker.com/api/v1/laws?jurisdiction=brazil&limit=100&sort=updated_at&order=desc"
    );
    expect(url).toContain("offset=0");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe(API_KEY);
  });
});

describe("fetchBrazilAiLaws — paginação por offset", () => {
  it("pagina quando meta.total > registros já buscados", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            apiRecord({ identifier: "br-lei-1" }),
            apiRecord({ identifier: "br-lei-2" }),
          ],
          meta: { count: 2, total: 3 },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [apiRecord({ identifier: "br-lei-3" })],
          meta: { count: 1, total: 3 },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBrazilAiLaws(API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.map((r) => r.identifier)).toEqual([
      "br-lei-1",
      "br-lei-2",
      "br-lei-3",
    ]);

    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(secondUrl).toContain("offset=2");
    expect(secondUrl).toContain("limit=100");
  });

  it("não pagina de novo quando a primeira página já cobre o total", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: [apiRecord({ identifier: "br-lei-1" })],
        meta: { count: 1, total: 1 },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBrazilAiLaws(API_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });
});

describe("fetchBrazilAiLaws — erro HTTP", () => {
  it("lança erro com status e corpo quando a resposta não é 200, sem engolir silenciosamente", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchBrazilAiLaws(API_KEY)).rejects.toThrow(
      /401.*unauthorized/s
    );
  });
});
