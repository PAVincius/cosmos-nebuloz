import { serve } from "inngest/next";
import { aiLawWatchFunction } from "@/lib/inngest/ai-law-watch";
import { billingSyncFunction } from "@/lib/inngest/billing-sync";
import { expireCharterControls } from "@/lib/inngest/charter-control-expiry";
import { inngest } from "@/lib/inngest/client";
import { consumeScaffoldGateClosed } from "@/lib/inngest/cosmos-scaffold-origin";
import { runExport } from "@/lib/inngest/export-runner";
import { fetchFathomTranscriptFn } from "@/lib/inngest/fathom-transcript";
import { mapFirefliesInsightsFn } from "@/lib/inngest/fireflies-insights";
import { fetchFirefliesTranscriptFn } from "@/lib/inngest/fireflies-transcript";
import { checkGovernanceSLA } from "@/lib/inngest/governance-sla";
import { monthlyIsolationAudit } from "@/lib/inngest/isolation-audit";
import { drainJobFallbackQueue } from "@/lib/inngest/job-fallback-drain";
import { linearFullPullDispatch } from "@/lib/inngest/linear-full-pull-dispatch";
import { consumeLinearWebhook } from "@/lib/inngest/linear-webhook-consumer";
import { reactToCharterControlExpired } from "@/lib/inngest/scaffold-charter-control-expired";
import { closeScaffoldObservation } from "@/lib/inngest/scaffold-observation";
import { checkScaffoldStall } from "@/lib/inngest/scaffold-stall";
import { scheduledReportDispatch } from "@/lib/inngest/scheduled-report-dispatch";
import { runScheduledReport } from "@/lib/inngest/scheduled-report-runner";
import { freezePlanOnBaseline } from "@/lib/inngest/signal-baseline-freeze";
import { checkSolutionStaleness } from "@/lib/inngest/solution-staleness";
import { deliverWebhookEvent } from "@/lib/inngest/webhook-delivery";
import { checkWorkflowSla } from "@/lib/inngest/workflow-sla";
import { releaseWorkflowWaitState } from "@/lib/inngest/workflow-wait-release";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    billingSyncFunction,
    aiLawWatchFunction,
    deliverWebhookEvent,
    checkGovernanceSLA,
    checkScaffoldStall,
    closeScaffoldObservation,
    checkSolutionStaleness,
    fetchFirefliesTranscriptFn,
    fetchFathomTranscriptFn,
    mapFirefliesInsightsFn,
    monthlyIsolationAudit,
    drainJobFallbackQueue,
    consumeLinearWebhook,
    linearFullPullDispatch,
    runExport,
    scheduledReportDispatch,
    runScheduledReport,
    releaseWorkflowWaitState,
    checkWorkflowSla,
    consumeScaffoldGateClosed,
    freezePlanOnBaseline,
    expireCharterControls,
    reactToCharterControlExpired,
  ],
});
