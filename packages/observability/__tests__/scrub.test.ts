import { describe, expect, it } from "vitest";
import {
  isSensitivePath,
  SENSITIVE_ROUTE_PREFIXES,
  scrubBreadcrumb,
  scrubRequestUrl,
  scrubUrl,
} from "../scrub";

describe("scrubUrl", () => {
  it("troca o segmento de token por :token numa URL absoluta", () => {
    expect(
      scrubUrl("https://app.nebuloz.ai/meridian-responder/abcd1234efgh")
    ).toBe("https://app.nebuloz.ai/meridian-responder/:token");
  });

  it("troca o segmento de token num path relativo, preservando o que vem depois", () => {
    expect(scrubUrl("/invite/abcd1234/complete")).toBe(
      "/invite/:token/complete"
    );
  });

  it("troca o token E tira a query string quando as duas aparecem juntas", () => {
    expect(scrubUrl("/meridian-responder/abcd1234?utm_source=email")).toBe(
      "/meridian-responder/:token"
    );
  });

  it("ainda tira a query string sozinha, sem rota de token no path", () => {
    expect(scrubUrl("https://app.nebuloz.ai/reset-password?token=abc123")).toBe(
      "https://app.nebuloz.ai/reset-password"
    );
  });

  it("não mexe em rotas fora da lista", () => {
    expect(scrubUrl("/cosmos/dashboard")).toBe("/cosmos/dashboard");
  });

  it("não quebra quando o prefixo aparece sem token depois (barra final só)", () => {
    expect(scrubUrl("/invite/")).toBe("/invite/");
  });

  it("cobre as duas rotas da lista (uma por prefixo)", () => {
    for (const prefix of SENSITIVE_ROUTE_PREFIXES) {
      expect(scrubUrl(`${prefix}um-token-qualquer`)).toBe(`${prefix}:token`);
    }
  });
});

describe("isSensitivePath", () => {
  it("reconhece as rotas com token no path", () => {
    expect(isSensitivePath("/meridian-responder/abc123")).toBe(true);
    expect(isSensitivePath("/invite/abc123")).toBe(true);
    expect(isSensitivePath("/invite/abc123/complete")).toBe(true);
  });

  it("reconhece a rota com token só na query string", () => {
    expect(isSensitivePath("/reset-password")).toBe(true);
  });

  it("não marca rotas sem token, nem o prefixo sem segmento", () => {
    expect(isSensitivePath("/cosmos/dashboard")).toBe(false);
    expect(isSensitivePath("/invite")).toBe(false);
  });
});

describe("scrubRequestUrl", () => {
  it("remove a query string de request.url", () => {
    const event = {
      request: { url: "https://app.nebuloz.ai/reset-password?token=abc123" },
    };
    expect(scrubRequestUrl(event).request?.url).toBe(
      "https://app.nebuloz.ai/reset-password"
    );
  });

  it("troca o token do path de request.url (meridian-responder/invite)", () => {
    const event = {
      request: { url: "https://app.nebuloz.ai/invite/abcd1234" },
    };
    expect(scrubRequestUrl(event).request?.url).toBe(
      "https://app.nebuloz.ai/invite/:token"
    );
  });

  it("limpa request.query_string junto (mesmo segredo, campo separado)", () => {
    const event = {
      request: {
        url: "https://app.nebuloz.ai/reset-password?token=abc123",
        query_string: "token=abc123",
      },
    };
    expect(scrubRequestUrl(event).request?.query_string).toBeUndefined();
  });

  it("remove a query string de transaction quando ela carrega a URL inteira", () => {
    const event = { transaction: "/reset-password?token=abc123" };
    expect(scrubRequestUrl(event).transaction).toBe("/reset-password");
  });

  it("troca o token do path em transaction", () => {
    const event = { transaction: "GET /meridian-responder/abcd1234" };
    expect(scrubRequestUrl(event).transaction).toBe(
      "GET /meridian-responder/:token"
    );
  });

  it("não mexe em transaction sem query string nem rota sensível (nome de rota normal)", () => {
    const event = { transaction: "GET /reset-password" };
    expect(scrubRequestUrl(event).transaction).toBe("GET /reset-password");
  });

  it("não quebra quando o evento não tem request nem transaction", () => {
    expect(scrubRequestUrl({})).toEqual({});
  });
});

describe("scrubBreadcrumb", () => {
  it("remove a query string de breadcrumbs de navigation (data.to/data.from)", () => {
    const breadcrumb = {
      category: "navigation",
      data: {
        from: "/sign-in",
        to: "/reset-password?token=abc123",
      },
    };
    expect(scrubBreadcrumb(breadcrumb).data).toEqual({
      from: "/sign-in",
      to: "/reset-password",
    });
  });

  it("troca o token do path em breadcrumbs de navigation (data.to)", () => {
    const breadcrumb = {
      category: "navigation",
      data: {
        from: "/dashboard",
        to: "/meridian-responder/abcd1234",
      },
    };
    expect(scrubBreadcrumb(breadcrumb).data).toEqual({
      from: "/dashboard",
      to: "/meridian-responder/:token",
    });
  });

  it("remove a query string de breadcrumbs de fetch/xhr (data.url)", () => {
    const breadcrumb = {
      category: "fetch",
      data: { url: "/api/reset-password?token=abc123&code=xyz" },
    };
    expect(breadcrumb.category && scrubBreadcrumb(breadcrumb).data?.url).toBe(
      "/api/reset-password"
    );
  });

  it("troca o token do path em breadcrumbs de xhr/fetch (data.url)", () => {
    const breadcrumb = {
      category: "xhr",
      data: { url: "/api/invite/abcd1234/complete" },
    };
    expect(scrubBreadcrumb(breadcrumb).data?.url).toBe(
      "/api/invite/:token/complete"
    );
  });

  it("ignora breadcrumbs de outras categorias (ex.: console, ui.click)", () => {
    const breadcrumb = {
      category: "console",
      data: { url: "/reset-password?token=abc123" },
    };
    expect(scrubBreadcrumb(breadcrumb).data?.url).toBe(
      "/reset-password?token=abc123"
    );
  });

  it("não quebra em breadcrumb sem data ou sem category", () => {
    expect(scrubBreadcrumb({ category: "navigation" })).toEqual({
      category: "navigation",
    });
    expect(scrubBreadcrumb({ data: { url: "/x?token=1" } })).toEqual({
      data: { url: "/x?token=1" },
    });
  });
});
