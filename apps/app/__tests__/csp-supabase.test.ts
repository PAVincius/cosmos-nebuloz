// @vitest-environment node

// P0 do QA: o navegador faz o PUT direto na URL assinada do Supabase Storage
// (upload de artefato de passo, entregável do Scaffold e evidência do Charter).
// O connect-src do CSP não tinha o host do Supabase, e o navegador barrava o PUT
// (securitypolicyviolation). A origem vem de NEXT_PUBLIC_SUPABASE_URL, só se a
// env existir.
import { config, supabaseOrigin } from "@repo/next-config";
import { afterEach, describe, expect, it, vi } from "vitest";

async function connectSrc(): Promise<string[]> {
  const headers = await config.headers?.();
  const csp = headers
    ?.flatMap((h) => h.headers)
    .find((h) => h.key === "Content-Security-Policy")?.value;
  const directive = csp?.split("; ").find((d) => d.startsWith("connect-src "));
  if (!directive) {
    throw new Error("connect-src ausente do CSP");
  }
  return directive.split(" ").slice(1);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("connect-src do CSP e o Supabase Storage", () => {
  it("com NEXT_PUBLIC_SUPABASE_URL, libera a ORIGEM do Supabase (sem o caminho)", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://abcd1234.supabase.co/rest/v1/"
    );

    const sources = await connectSrc();

    expect(sources).toContain("https://abcd1234.supabase.co");
    expect(sources.some((s) => s.includes("/rest"))).toBe(false);
  });

  it("sem a env, o CSP não ganha nenhum host novo", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    const sources = await connectSrc();

    expect(sources.some((s) => s.includes("supabase"))).toBe(false);
    // O que já existia continua.
    expect(sources).toContain("'self'");
    expect(sources).toContain("https://api.inngest.com");
  });

  it("URL inválida na env não derruba o headers() nem entra no CSP", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "isto não é uma url");

    const sources = await connectSrc();

    expect(sources.some((s) => s.includes("isto"))).toBe(false);
  });

  it("supabaseOrigin devolve só a origem, ou null", () => {
    expect(supabaseOrigin("https://x.supabase.co/storage/v1")).toBe(
      "https://x.supabase.co"
    );
    expect(supabaseOrigin("http://localhost:54321")).toBe(
      "http://localhost:54321"
    );
    expect(supabaseOrigin("")).toBeNull();
    expect(supabaseOrigin(undefined)).toBeNull();
    expect(supabaseOrigin("nao-e-url")).toBeNull();
  });

  it.each([
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/plain,x",
    "ftp://x.supabase.co",
    "blob:https://x.supabase.co/uuid",
  ])("só http: e https: viram origem: %s não (new URL(...).origin vira a string 'null')", async (url) => {
    expect(supabaseOrigin(url)).toBeNull();

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    const sources = await connectSrc();
    expect(sources).not.toContain("null");
    expect(
      sources.some((s) => /^(file|javascript|data|ftp|blob):/.test(s))
    ).toBe(false);
  });

  it("não afrouxa o resto do CSP", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd1234.supabase.co");
    const headers = await config.headers?.();
    const csp = headers
      ?.flatMap((h) => h.headers)
      .find((h) => h.key === "Content-Security-Policy")?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("connect-src *");
  });
});
