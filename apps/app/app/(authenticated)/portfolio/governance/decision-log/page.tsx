import type { PageMeta } from "@/app/actions/_base";
import type { DecisionLogEntryPublic } from "@/app/actions/governance";
import { listDecisionLog } from "@/app/actions/governance";
import { DecisionLogTable } from "./components/decision-log-table";

export const metadata = { title: "Decision Log — COSMOS" };

const EMPTY_META: PageMeta = {
  total: 0,
  page: 1,
  limit: 50,
  pageCount: 0,
  hasNext: false,
  hasPrev: false,
};

export default async function DecisionLogPage() {
  const result = await listDecisionLog();
  const items: DecisionLogEntryPublic[] = result.ok ? result.data.items : [];
  const meta: PageMeta = result.ok ? result.data.meta : EMPTY_META;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Decision Log</h1>
        <p className="text-muted-foreground text-sm">
          Histórico auditável de decisões de portfólio LPM
        </p>
      </div>
      <DecisionLogTable items={items} meta={meta} />
    </div>
  );
}
