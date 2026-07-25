import { createHmac, timingSafeEqual } from "node:crypto";
import {
  fetchFirefliesTranscript,
  normalizeFirefliesSummary,
} from "../../inngest/fireflies-normalize";
import type { MeetingProvider, NormalizedSummary } from "../provider";

export class FirefliesAdapter implements MeetingProvider {
  readonly provider = "fireflies";

  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const hmac = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expected = Buffer.from(`sha256=${hmac}`);
    const received = Buffer.from(signature);
    if (expected.length !== received.length) {
      return false;
    }
    return timingSafeEqual(expected, received);
  }

  extractMeetingId(payload: unknown): string | null {
    return (payload as { meetingId?: string }).meetingId ?? null;
  }

  fetchTranscript(apiKey: string, meetingId: string): Promise<unknown> {
    return fetchFirefliesTranscript(apiKey, meetingId);
  }

  normalizeSummary(raw: unknown): NormalizedSummary {
    return normalizeFirefliesSummary(
      raw as Parameters<typeof normalizeFirefliesSummary>[0]
    );
  }
}
