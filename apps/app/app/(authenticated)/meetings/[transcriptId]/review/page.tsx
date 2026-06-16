import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CopilotTriggerButton } from "@/app/(authenticated)/components/copilot/copilot-trigger-button";
import { listMeetingInsights } from "@/app/actions/meeting/insights";
import { appDesign } from "@/lib/app-design";
import { PageHeader } from "../../../components/page-header";
import { ReviewClient } from "./review-client";
import { TranscriptSummaryPanel } from "./transcript-summary-panel";

type Props = {
  params: Promise<{ transcriptId: string }>;
};

export default async function InsightReviewPage({ params }: Props) {
  const { transcriptId } = await params;
  const ctx = await requireTenantSession(await headers());

  const transcript = await database.meetingTranscript.findFirst({
    where: { id: transcriptId, tenantId: ctx.tenantId },
    select: { id: true, title: true, meetingId: true, rawSummary: true },
  });
  if (!transcript) {
    notFound();
  }

  const result = await listMeetingInsights(transcriptId);
  const insights = result.ok ? result.data : [];

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <CopilotTriggerButton
            contextRef={{ transcriptId, meetingId: transcript.meetingId }}
            label="Copilot Meeting"
            mode="spc"
            surface="meeting_review"
          />
        }
        breadcrumb={[
          { label: "Meetings", href: "/meetings" },
          { label: transcript.title ?? transcript.meetingId },
        ]}
        subtitle="Revise cada insight antes de criar entidades no COSMOS."
        title="Revisão de Insights"
      />
      <div className={appDesign.bodyScroll}>
        <div className="space-y-6">
          <TranscriptSummaryPanel rawSummary={transcript.rawSummary} />
          <ReviewClient initial={insights} transcriptTitle={transcript.title} />
        </div>
      </div>
    </div>
  );
}
