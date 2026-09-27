/**
 * Faixa fixa no topo fora de produção — pedido do CEO depois de rodar passos
 * de produção 2x no localhost:3012 achando que era app.nebuloz.ai (telas
 * idênticas, autocomplete do navegador preencheu). Decisão só no servidor
 * (`VERCEL_ENV`, nunca `window.location`) porque é exatamente a diferença
 * que a pessoa não percebeu olhando a tela.
 */
export function resolveEnvironmentBannerLabel(
  vercelEnv: string | undefined
): string | null {
  if (vercelEnv === "production") {
    return null;
  }
  return vercelEnv === "preview"
    ? "PREVIEW — não é produção"
    : "AMBIENTE LOCAL — não é produção";
}

type EnvironmentBannerProps = {
  vercelEnv: string | undefined;
};

export function EnvironmentBanner({ vercelEnv }: EnvironmentBannerProps) {
  const label = resolveEnvironmentBannerLabel(vercelEnv);
  if (!label) {
    return null;
  }

  return (
    <output
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#dc2626",
        color: "#fff",
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
        padding: "4px 8px",
      }}
    >
      {label}
    </output>
  );
}
