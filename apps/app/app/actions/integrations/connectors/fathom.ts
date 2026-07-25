const FATHOM_API_BASE = "https://api.fathom.video/v1";

export function buildFathomWebhookUrl(
  baseUrl: string,
  integrationId: string
): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/api/webhooks/fathom/${integrationId}`;
}

export async function fathomTestConnection(
  apiKey: string
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await fetch(`${FATHOM_API_BASE}/account`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return { ok: false, error: `Fathom API ${res.status}` };
    }

    const json = (await res.json()) as { name?: string; email?: string };
    return { ok: true, name: json.name ?? json.email };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha na conexão",
    };
  }
}
