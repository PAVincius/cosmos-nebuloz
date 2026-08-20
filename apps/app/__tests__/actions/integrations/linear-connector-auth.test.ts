// linear-connector-auth.test.ts — o header de autorização do conector do
// Linear.
//
// Personal API key (lin_api_...) vai em `Authorization: <key>`, sem Bearer —
// Bearer é o formato de token OAuth, e a API responde 400 INPUT_ERROR ("It
// looks like you're trying to use an API key as a Bearer token") para chave
// pessoal com o prefixo. O conector mandava Bearer e ninguém percebeu porque
// todos os testes mockavam camadas acima do fetch; o 400 só apareceu na
// primeira conexão real em produção. linear-push.ts e linear-full-pull.ts
// sempre mandaram cru — este teste alinha o conector com eles.
import { afterEach, describe, expect, it, vi } from "vitest";
import { linearTestConnection } from "../../../app/actions/integrations/connectors/linear";

const API_KEY = "lin_api_teste_0000000000000000";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("linearQuery — header de autorização", () => {
  it("manda a personal API key crua, sem prefixo Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { viewer: { id: "u1", name: "Nebuloz" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await linearTestConnection(API_KEY);

    expect(result.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe(API_KEY);
    expect(auth.startsWith("Bearer")).toBe(false);
  });
});
