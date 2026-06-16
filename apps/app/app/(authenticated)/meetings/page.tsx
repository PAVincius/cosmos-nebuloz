import { Badge } from "@repo/design-system/components/ui/badge";
import Link from "next/link";
import { Suspense } from "react";
import {
  listMeetingTimeline,
  searchMeetings,
} from "@/app/actions/meeting/insights";
import { appDesign } from "@/lib/app-design";
import { PageHeader } from "../components/page-header";
import { MeetingSearchBar } from "./meeting-search-bar";

export const metadata = {
  title: "Meetings | COSMOS",
  description: "Timeline de cerimônias SAFe e insights capturados",
};

type SearchParams = {
  query?: string;
  from?: string;
  to?: string;
  insightType?: string;
};

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const hasFilter = sp.query || sp.from || sp.to || sp.insightType;
  const result = hasFilter
    ? await searchMeetings({
        query: sp.query,
        from: sp.from,
        to: sp.to,
        insightType: sp.insightType,
      })
    : await listMeetingTimeline();
  const transcripts = result.ok ? result.data : [];

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[{ label: "Meetings" }]}
        subtitle="Cerimônias transcritas e insights capturados por PI."
        title="Meeting Intelligence"
      />
      <div className={appDesign.bodyScroll}>
        <Suspense>
          <MeetingSearchBar />
        </Suspense>
        {transcripts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma cerimônia transcrita ainda. Conecte o Fireflies em{" "}
            <Link className="underline" href="/settings/integrations/meeting">
              Configurações → Integrações → Meeting
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {transcripts.map((t) => (
              <li key={t.id}>
                <Link
                  className="flex items-center justify-between p-4 transition-colors hover:bg-muted/50"
                  href={`/meetings/${t.id}/review`}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {t.title ?? t.meetingId}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t.createdAt.toLocaleDateString("pt-BR")}
                      {t.piPlanId ? ` · PI ${t.piPlanId}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {t.counts.pending > 0 && (
                      <Badge variant="default">
                        {t.counts.pending} pendente
                      </Badge>
                    )}
                    {t.counts.applied > 0 && (
                      <Badge variant="outline">
                        {t.counts.applied} aplicado
                      </Badge>
                    )}
                    {t.counts.dismissed > 0 && (
                      <Badge variant="secondary">
                        {t.counts.dismissed} desc.
                      </Badge>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
