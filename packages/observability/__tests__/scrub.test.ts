import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubRequestUrl } from "../scrub";

describe("scrubRequestUrl", () => {
  it("remove a query string de request.url", () => {
    const event = {
      request: { url: "https://app.nebuloz.ai/reset-password?token=abc123" },
    };
    expect(scrubRequestUrl(event).request?.url).toBe(
      "https://app.nebuloz.ai/reset-password"
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

  it("não mexe em transaction sem query string (nome de rota normal)", () => {
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

  it("remove a query string de breadcrumbs de fetch/xhr (data.url)", () => {
    const breadcrumb = {
      category: "fetch",
      data: { url: "/api/reset-password?token=abc123&code=xyz" },
    };
    expect(breadcrumb.category && scrubBreadcrumb(breadcrumb).data?.url).toBe(
      "/api/reset-password"
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
