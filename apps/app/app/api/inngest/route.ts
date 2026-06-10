import { serve } from "inngest/next";
import { billingSyncFunction } from "@/lib/inngest/billing-sync";
import { inngest } from "@/lib/inngest/client";
import { fetchFathomTranscriptFn } from "@/lib/inngest/fathom-transcript";
import { mapFirefliesInsightsFn } from "@/lib/inngest/fireflies-insights";
import { fetchFirefliesTranscriptFn } from "@/lib/inngest/fireflies-transcript";
import { checkGovernanceSLA } from "@/lib/inngest/governance-sla";
import { monthlyIsolationAudit } from "@/lib/inngest/isolation-audit";
import { processErasureRequest } from "@/lib/inngest/lgpd-dsr";
import { checkSolutionStaleness } from "@/lib/inngest/solution-staleness";
import { deliverWebhookEvent } from "@/lib/inngest/webhook-delivery";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    billingSyncFunction,
    processErasureRequest,
    deliverWebhookEvent,
    checkGovernanceSLA,
    checkSolutionStaleness,
    fetchFirefliesTranscriptFn,
    fetchFathomTranscriptFn,
    mapFirefliesInsightsFn,
    monthlyIsolationAudit,
  ],
});
