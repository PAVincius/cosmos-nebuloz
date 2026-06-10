// Provider-agnostic interface for meeting intelligence adapters.
// Fireflies = first impl. Fathom = second. Otter = future slot.

export type NormalizedSummary = {
  title: string | null;
  rawSummary: {
    overview: string | null;
    actionItems: string | null;
    keywords: string[];
    outline: string | null;
  };
};

export type MeetingProvider = {
  readonly provider: string;
  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean;
  extractMeetingId(payload: unknown): string | null;
  fetchTranscript(apiKey: string, meetingId: string): Promise<unknown>;
  normalizeSummary(raw: unknown): NormalizedSummary;
};

import { FathomAdapter } from "./providers/fathom";
import { FirefliesAdapter } from "./providers/fireflies";

const REGISTRY: Record<string, MeetingProvider> = {
  fireflies: new FirefliesAdapter(),
  fathom: new FathomAdapter(),
};

export function getProvider(name: string): MeetingProvider | null {
  return REGISTRY[name] ?? null;
}
