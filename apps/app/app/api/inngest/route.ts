import { serve } from "inngest/next";
import { billingSyncFunction } from "@/lib/inngest/billing-sync";
import { inngest } from "@/lib/inngest/client";
import { checkGovernanceSLA } from "@/lib/inngest/governance-sla";
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
  ],
});
