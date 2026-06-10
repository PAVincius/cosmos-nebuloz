import { createHmac, timingSafeEqual } from "node:crypto";
import type { MeetingProvider, NormalizedSummary } from "../provider";

const FATHOM_API_BASE = "https://api.fathom.video/v1";

type FathomCall = {
  title?: string;
  action_items?: { text: string }[];
  highlights?: { text: string }[];
};

export class FathomAdapter implements MeetingProvider {
  readonly provider = "fathom";

  // Fathom sends X-Fathom-Webhook-Signature: sha256=<hmac> — same scheme as Fireflies.
  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const hmac = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expected = Buffer.from(`sha256=${hmac}`);
    const received = Buffer.from(signature);
    if (expected.length !== received.length) {
      return false;
    }
    return timingSafeEqual(expected, received);
  }

  // Fathom webhook payload: { event: "call.completed", call_id: "..." }
  extractMeetingId(payload: unknown): string | null {
    return (payload as { call_id?: string }).call_id ?? null;
  }

  async fetchTranscript(
    apiKey: string,
    meetingId: string
  ): Promise<FathomCall> {
    const res = await fetch(`${FATHOM_API_BASE}/calls/${meetingId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Fathom API ${res.status}`);
    }
    return res.json() as Promise<FathomCall>;
  }

  normalizeSummary(raw: unknown): NormalizedSummary {
    const call = raw as FathomCall | null | undefined;
    const actionItems =
      call?.action_items?.map((i) => i.text).join("\n") ?? null;
    const overviewLines = call?.highlights?.map((h) => h.text) ?? [];
    return {
      title: call?.title ?? null,
      rawSummary: {
        overview: overviewLines.length > 0 ? overviewLines.join("\n") : null,
        actionItems,
        keywords: [],
        outline: null,
      },
    };
  }
}
