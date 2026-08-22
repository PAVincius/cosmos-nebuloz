// Pure Fireflies helpers — zero heavy imports so they stay unit-testable
// without triggering env validation from @repo/* packages.

const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";

const TRANSCRIPT_QUERY = `query Transcript($id: String!) {
  transcript(id: $id) {
    id
    title
    summary { overview action_items keywords outline }
  }
}`;

// Shape returned by the Fireflies `transcript` query (subset we consume).
export type FirefliesTranscript = {
  id?: string;
  title?: string;
  summary?: {
    overview?: string;
    action_items?: string;
    keywords?: string[];
    outline?: string;
  };
};

export type NormalizedSummary = {
  title: string | null;
  rawSummary: {
    overview: string | null;
    actionItems: string | null;
    keywords: string[];
    outline: string | null;
  };
};

/**
 * Pure normalizer: maps a Fireflies transcript into our internal shape.
 * Defensive against missing fields — never throws on partial payloads.
 */
export function normalizeFirefliesSummary(
  transcript: FirefliesTranscript | null | undefined
): NormalizedSummary {
  const summary = transcript?.summary ?? {};
  return {
    title: transcript?.title ?? null,
    rawSummary: {
      overview: summary.overview ?? null,
      actionItems: summary.action_items ?? null,
      keywords: Array.isArray(summary.keywords) ? summary.keywords : [],
      outline: summary.outline ?? null,
    },
  };
}

export async function fetchFirefliesTranscript(
  apiKey: string,
  meetingId: string
): Promise<FirefliesTranscript> {
  const res = await fetch(FIREFLIES_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: TRANSCRIPT_QUERY,
      variables: { id: meetingId },
    }),
  });

  if (!res.ok) {
    throw new Error(`Fireflies GraphQL HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    data?: { transcript?: FirefliesTranscript };
    errors?: unknown;
  };

  if (json.errors) {
    throw new Error(`Fireflies GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data?.transcript ?? {};
}
