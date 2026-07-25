const FIREFLIES_GQL = "https://api.fireflies.ai/graphql";

/**
 * Builds the per-integration webhook URL the user pastes into the Fireflies
 * dashboard. Pure — no env/IO, so it is unit-testable.
 */
export function buildFirefliesWebhookUrl(
  baseUrl: string,
  integrationId: string
): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/api/webhooks/fireflies/${integrationId}`;
}

/**
 * Validates a Fireflies API key with a lightweight authenticated query.
 * Returns { ok, name?, error? } — never throws.
 */
export async function firefliesTestConnection(
  apiKey: string
): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const res = await fetch(FIREFLIES_GQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: "query { users { name } }" }),
    });

    if (!res.ok) {
      return { ok: false, error: `Fireflies API ${res.status}` };
    }

    const json = (await res.json()) as {
      data?: { users?: { name?: string }[] };
      errors?: { message: string }[];
    };

    if (json.errors?.length) {
      return { ok: false, error: json.errors.map((e) => e.message).join("; ") };
    }

    return { ok: true, name: json.data?.users?.[0]?.name };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha na conexão",
    };
  }
}
