import { describe, expect, it } from "vitest";
import {
  appHostsFromEnv,
  checkExternalLink,
  PROVIDER_LABEL,
  safeHref,
} from "@/lib/scaffold/external-links";

// Vínculo do entregável com item externo (Norte e.2, S6). A URL vem do usuário e
// vira link clicável na tela de outras pessoas: só entra host da lista por
// provedor, https, sem credencial na URL. Nada é buscado do servidor (sem fetch,
// então sem SSRF), e o estado do item externo nunca muda o entregável.

const APP = { appHosts: ["app.nebuloz.ai"] };
const ok = (provider: string, externalId: string, url: string) =>
  checkExternalLink({ provider: provider as never, externalId, url }, APP);

describe("URLs aceitas", () => {
  it.each([
    ["LINEAR", "ENG-123", "https://linear.app/nebuloz/issue/ENG-123/titulo"],
    ["GITHUB", "nebuloz/app#42", "https://github.com/nebuloz/app/issues/42"],
    ["JIRA", "PROJ-45", "https://nebuloz.atlassian.net/browse/PROJ-45"],
    [
      "COSMOS",
      "clx0000000000000000epic01",
      "https://app.nebuloz.ai/cosmos/epics/clx0000000000000000epic01",
    ],
  ])("%s %s", (provider, id, url) => {
    const r = ok(provider, id, url);
    expect(r).toMatchObject({ ok: true, externalId: id });
    expect(r.ok && r.url).toBe(new URL(url).href);
  });

  it("host em maiúsculas é normalizado, e o que se guarda é a URL normalizada", () => {
    const r = ok("LINEAR", "ENG-1", "https://LINEAR.APP/x/issue/ENG-1");
    expect(r.ok && r.url).toBe("https://linear.app/x/issue/ENG-1");
  });

  it("espaços nas pontas são aparados", () => {
    expect(
      ok("GITHUB", "  a/b#1  ", "  https://github.com/a/b/issues/1  ").ok
    ).toBe(true);
  });
});

describe("URLs recusadas", () => {
  it.each([
    ["http (sem TLS)", "LINEAR", "http://linear.app/x/issue/ENG-1"],
    ["javascript:", "LINEAR", "javascript:alert(1)"],
    ["data:", "GITHUB", "data:text/html,<script>alert(1)</script>"],
    ["file:", "GITHUB", "file:///etc/passwd"],
    ["host de outro provedor", "LINEAR", "https://github.com/a/b/issues/1"],
    ["sufixo enganoso", "LINEAR", "https://linear.app.evil.com/x"],
    ["prefixo enganoso", "GITHUB", "https://evilgithub.com/a/b"],
    ["host no caminho", "LINEAR", "https://evil.com/linear.app/x"],
    ["credencial na URL", "GITHUB", "https://github.com@evil.com/a/b"],
    ["usuário e senha", "GITHUB", "https://user:pass@github.com/a/b"],
    ["porta explícita", "LINEAR", "https://linear.app:8443/x"],
    ["Jira sem subdomínio", "JIRA", "https://atlassian.net/browse/P-1"],
    [
      "Jira em host de terceiros",
      "JIRA",
      "https://nebuloz.atlassian.net.evil.com/browse/P-1",
    ],
    ["IP", "LINEAR", "https://127.0.0.1/x"],
    ["localhost", "COSMOS", "https://localhost:3012/cosmos"],
    ["Cosmos em outro host", "COSMOS", "https://outro.com/cosmos"],
    ["vazia", "LINEAR", ""],
    ["não é URL", "LINEAR", "linear.app/x"],
  ])("%s", (_n, provider, url) => {
    const r = ok(provider, "ID-1", url);
    expect(r.ok).toBe(false);
  });

  it("URL gigante", () => {
    expect(
      ok("LINEAR", "ENG-1", `https://linear.app/${"a".repeat(2100)}`).ok
    ).toBe(false);
  });

  it("provedor desconhecido", () => {
    expect(ok("SLACK", "X-1", "https://slack.com/x").ok).toBe(false);
  });

  it("subdomínio de linear.app e github.com não vale: só o host exato", () => {
    expect(ok("LINEAR", "E-1", "https://foo.linear.app/x").ok).toBe(false);
    expect(ok("GITHUB", "a/b#1", "https://gist.github.com/x").ok).toBe(false);
  });

  it("a mensagem diz o que vale para aquele provedor, sem ecoar a URL digitada", () => {
    const r = ok("LINEAR", "ENG-1", "https://evil.example/segredo-token=abc");
    expect(!r.ok && r.message).toMatch(/linear\.app/);
    expect(!r.ok && r.message).not.toContain("segredo-token");
  });
});

describe("identificador externo", () => {
  it.each([
    "",
    "   ",
    "com espaço",
    "a<b>",
    "x".repeat(129),
    "linha\nquebrada",
  ])("recusa %j", (id) => {
    expect(ok("LINEAR", id, "https://linear.app/x/issue/ENG-1").ok).toBe(false);
  });

  it.each([
    "ENG-123",
    "org/repo#12",
    "PROJ-45",
    "clx0000000000000000epic01",
    "a.b_c:d",
  ])("aceita %s", (id) => {
    expect(ok("LINEAR", id, "https://linear.app/x/issue/ENG-1").ok).toBe(true);
  });
});

describe("Cosmos: o próprio app", () => {
  it("sem origem do app configurada, o Cosmos não tem host válido", () => {
    const r = checkExternalLink(
      {
        provider: "COSMOS",
        externalId: "x1",
        url: "https://app.nebuloz.ai/cosmos",
      },
      { appHosts: [] }
    );
    expect(r.ok).toBe(false);
  });

  it("appHostsFromEnv lê o host de NEXT_PUBLIC_APP_URL", () => {
    expect(appHostsFromEnv("https://app.nebuloz.ai")).toEqual([
      "app.nebuloz.ai",
    ]);
    expect(appHostsFromEnv("https://app.nebuloz.ai/")).toEqual([
      "app.nebuloz.ai",
    ]);
  });

  it("appHostsFromEnv: ausente ou inválida, lista vazia", () => {
    expect(appHostsFromEnv(undefined)).toEqual([]);
    expect(appHostsFromEnv("")).toEqual([]);
    expect(appHostsFromEnv("não é url")).toEqual([]);
  });

  it("em desenvolvimento (http://localhost) o host vale só para o Cosmos local", () => {
    // O app local roda em http; o link para si mesmo precisa aceitar isso, e só
    // quando o próprio app está configurado assim.
    const r = checkExternalLink(
      {
        provider: "COSMOS",
        externalId: "x1",
        url: "http://localhost:3012/cosmos/epics/x1",
      },
      { appHosts: ["localhost:3012"] }
    );
    expect(r.ok).toBe(true);
    const bad = checkExternalLink(
      { provider: "LINEAR", externalId: "E-1", url: "http://localhost:3012/x" },
      { appHosts: ["localhost:3012"] }
    );
    expect(bad.ok).toBe(false);
  });
});

describe("rótulos", () => {
  it("cada provedor tem nome legível", () => {
    expect(PROVIDER_LABEL).toEqual({
      COSMOS: "Cosmos",
      LINEAR: "Linear",
      GITHUB: "GitHub",
      JIRA: "Jira",
    });
  });
});

describe("safeHref", () => {
  it("só devolve link clicável para https", () => {
    expect(safeHref("https://linear.app/x")).toBe("https://linear.app/x");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,x",
    "http://evil.com/x",
    "file:///etc/passwd",
    "não é url",
    "",
  ])("%j não vira link", (url) => {
    expect(safeHref(url)).toBeNull();
  });

  it("http só para o app local", () => {
    expect(safeHref("http://localhost:3012/cosmos")).toBe(
      "http://localhost:3012/cosmos"
    );
    expect(safeHref("http://127.0.0.1:3012/x")).toBe("http://127.0.0.1:3012/x");
  });
});
