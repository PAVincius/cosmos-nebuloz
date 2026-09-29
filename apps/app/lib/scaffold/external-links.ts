// Vínculo do entregável com item externo (Norte e.2, S6). Puro, sem rede.
//
// A URL vem do usuário e vira link clicável na tela de outras pessoas. Por isso
// só entra host da lista de cada provedor, em https, sem credencial nem porta na
// URL. Nada é buscado pelo servidor (sem fetch, então sem SSRF): o link é
// referência, e o estado do item externo nunca muda o entregável.

export type LinkProvider = "COSMOS" | "LINEAR" | "GITHUB" | "JIRA";

export const PROVIDER_LABEL: Record<LinkProvider, string> = {
  COSMOS: "Cosmos",
  LINEAR: "Linear",
  GITHUB: "GitHub",
  JIRA: "Jira",
};

export type LinkInput = {
  provider: LinkProvider;
  externalId: string;
  url: string;
};

export type LinkCheck =
  | { ok: true; url: string; externalId: string }
  | { ok: false; message: string };

const MAX_URL = 2048;
const MAX_ID = 128;
const ID_PATTERN = /^[\w.\-#/:]+$/;
const LOOPBACK = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Host da própria aplicação, com porta quando houver (desenvolvimento). */
export function appHostsFromEnv(appUrl: string | undefined): string[] {
  try {
    return appUrl ? [new URL(appUrl).host] : [];
  } catch {
    return [];
  }
}

const refuse = (message: string): LinkCheck => ({ ok: false, message });

function hostRule(
  provider: LinkProvider,
  host: string,
  appHosts: string[]
): { ok: boolean; hint: string } {
  switch (provider) {
    case "LINEAR":
      return { ok: host === "linear.app", hint: "linear.app" };
    case "GITHUB":
      return { ok: host === "github.com", hint: "github.com" };
    case "JIRA":
      return {
        ok: host.endsWith(".atlassian.net") && host.split(".").length >= 3,
        hint: "*.atlassian.net",
      };
    case "COSMOS":
      return {
        ok: appHosts.includes(host),
        hint: appHosts.length
          ? appHosts.join(", ")
          : "o endereço do próprio app",
      };
    default:
      return { ok: false, hint: "" };
  }
}

export function checkExternalLink(
  input: LinkInput,
  { appHosts }: { appHosts: string[] }
): LinkCheck {
  if (!(input.provider in PROVIDER_LABEL)) {
    return refuse("Provedor não suportado.");
  }
  const externalId = input.externalId.trim();
  if (
    !externalId ||
    externalId.length > MAX_ID ||
    !ID_PATTERN.test(externalId)
  ) {
    return refuse(
      "Identificador inválido: use letras, números e . _ - # / : , sem espaço, com até 128 caracteres."
    );
  }

  const raw = input.url.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return refuse("Informe a URL completa, começando por https://.");
  }
  if (raw.length > MAX_URL) {
    return refuse("URL longa demais.");
  }

  const rule = hostRule(input.provider, url.host, appHosts);
  const label = PROVIDER_LABEL[input.provider];
  const wrongHost = refuse(`Só links de ${rule.hint} valem para ${label}.`);

  // O app local roda em http; o link para si mesmo aceita isso, e só isso.
  const localCosmos =
    input.provider === "COSMOS" && LOOPBACK.test(url.host) && rule.ok;
  if (url.protocol !== "https:" && !(localCosmos && url.protocol === "http:")) {
    return refuse("A URL precisa ser https://.");
  }
  if (url.username || url.password) {
    return refuse("A URL não pode levar usuário nem senha.");
  }
  if (!rule.ok) {
    return wrongHost;
  }
  // Porta explícita só para o próprio app (o host dele já a inclui).
  if (input.provider !== "COSMOS" && url.port !== "") {
    return wrongHost;
  }
  return { ok: true, url: url.href, externalId };
}

/**
 * URL segura para virar `href`. O que está no banco já passou por
 * `checkExternalLink`, mas a tela não confia nisso: linha antiga, importada ou
 * escrita por outro caminho não pode virar `javascript:` clicável.
 */
export function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") {
      return u.href;
    }
    if (u.protocol === "http:" && LOOPBACK.test(u.host)) {
      return u.href;
    }
  } catch {
    // não é URL
  }
  return null;
}
