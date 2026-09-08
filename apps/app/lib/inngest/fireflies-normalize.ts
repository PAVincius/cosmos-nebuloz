// Pure Fireflies helpers — zero heavy imports so they stay unit-testable
// without triggering env validation from @repo/* packages.

export const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";

// Campos de participante — docs/compliance/consentimento-de-gravacao.md §4
// ("Participantes — campos confirmados"). `participants` traz e-mails de
// todo mundo, inclusive quem não tem conta Fireflies; `workspace_users` traz
// só quem é do workspace. A subtração das duas listas é o que identifica
// participante externo (ver normalizeFirefliesParticipants abaixo) — sem
// depender de um campo de domínio no Tenant, que é exatamente o motivo pelo
// qual a detecção automática tinha sido descartada antes desses campos
// serem confirmados.
export const TRANSCRIPT_QUERY = `query Transcript($id: String!) {
  transcript(id: $id) {
    id
    title
    summary { overview action_items keywords outline }
    participants
    meeting_attendees { displayName email }
    fireflies_users
    workspace_users
    organizer_email
  }
}`;

// Shape returned by the Fireflies `transcript` query (subset we consume).
export type FirefliesMeetingAttendee = {
  displayName?: string;
  email?: string;
};

export type FirefliesTranscript = {
  id?: string;
  title?: string;
  summary?: {
    overview?: string;
    action_items?: string;
    keywords?: string[];
    outline?: string;
  };
  participants?: string[];
  meeting_attendees?: FirefliesMeetingAttendee[];
  fireflies_users?: string[];
  workspace_users?: string[];
  organizer_email?: string;
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

export type NormalizedParticipant = {
  email: string;
  name: string | null;
  isOrganizer: boolean;
  isExternal: boolean;
};

export type NormalizedParticipants = {
  // false = o provedor não devolveu os dois campos necessários para a
  // subtração de listas (plano não expõe participantes, ou resposta veio
  // parcial). Ausência de dado é desconhecido, não é "sem externo" — quem
  // consome isto (o gate de STANDING em fireflies-transcript.ts) precisa
  // tratar known=false como PENDING, nunca como "reunião sem externo".
  known: boolean;
  participants: NormalizedParticipant[];
};

/**
 * Pure normalizer: participante externo = está em `participants` e NÃO está
 * em `workspace_users` (docs/compliance/consentimento-de-gravacao.md §4).
 * Fail closed: exige os dois campos como array — um payload que só trouxe um
 * dos dois (plano do provedor não expõe, resposta parcial) é tratado como
 * "não sabemos", nunca como "reunião sem externo".
 */
export function normalizeFirefliesParticipants(
  transcript: FirefliesTranscript | null | undefined
): NormalizedParticipants {
  const participantEmails = transcript?.participants;
  const workspaceEmails = transcript?.workspace_users;

  if (!(Array.isArray(participantEmails) && Array.isArray(workspaceEmails))) {
    return { known: false, participants: [] };
  }

  const workspaceSet = new Set(
    workspaceEmails.filter(Boolean).map((e) => e.toLowerCase())
  );

  const nameByEmail = new Map<string, string>();
  for (const attendee of transcript?.meeting_attendees ?? []) {
    if (attendee.email && attendee.displayName) {
      nameByEmail.set(attendee.email.toLowerCase(), attendee.displayName);
    }
  }

  const organizerEmail = transcript?.organizer_email?.toLowerCase() ?? null;

  const seen = new Set<string>();
  const participants: NormalizedParticipant[] = [];
  for (const rawEmail of participantEmails) {
    if (!rawEmail) {
      continue;
    }
    const lower = rawEmail.toLowerCase();
    if (seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    participants.push({
      email: rawEmail,
      name: nameByEmail.get(lower) ?? null,
      isOrganizer: lower === organizerEmail,
      isExternal: !workspaceSet.has(lower),
    });
  }

  return { known: true, participants };
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
