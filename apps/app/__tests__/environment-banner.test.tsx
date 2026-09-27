import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EnvironmentBanner,
  resolveEnvironmentBannerLabel,
} from "../app/environment-banner";

describe("resolveEnvironmentBannerLabel", () => {
  it("local (sem VERCEL_ENV)", () => {
    expect(resolveEnvironmentBannerLabel(undefined)).toBe(
      "AMBIENTE LOCAL — não é produção"
    );
  });

  it("preview", () => {
    expect(resolveEnvironmentBannerLabel("preview")).toBe(
      "PREVIEW — não é produção"
    );
  });

  it("produção — nenhuma faixa", () => {
    expect(resolveEnvironmentBannerLabel("production")).toBeNull();
  });
});

describe("EnvironmentBanner — faixa de ambiente (pedido do CEO)", () => {
  it("renderiza em ambiente local", () => {
    render(<EnvironmentBanner vercelEnv={undefined} />);
    expect(screen.getByText(/ambiente local/i)).toBeTruthy();
  });

  it("renderiza em preview", () => {
    render(<EnvironmentBanner vercelEnv="preview" />);
    expect(screen.getByText(/preview/i)).toBeTruthy();
  });

  it("não renderiza nada em produção", () => {
    const { container } = render(<EnvironmentBanner vercelEnv="production" />);
    expect(container.firstChild).toBeNull();
  });
});
