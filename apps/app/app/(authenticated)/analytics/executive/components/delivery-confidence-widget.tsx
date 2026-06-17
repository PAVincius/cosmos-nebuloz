import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import type { PortfolioConfidence } from "@/app/actions/analytics/epic-confidence";

function fmt(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
}

const RISK_DOT: Record<"AMBER" | "RED", string> = {
  AMBER: "bg-amber-500",
  RED: "bg-rose-500",
};

type DeliveryConfidenceWidgetProps = {
  data: PortfolioConfidence;
};

export function DeliveryConfidenceWidget({
  data,
}: DeliveryConfidenceWidgetProps) {
  const { green, amber, red, gray, atRisk } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery Confidence</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-6 text-sm">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            On track {green}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            At risk {amber}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            Slipping {red}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            No data {gray}
          </span>
        </div>

        {atRisk.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {atRisk.map((e) => (
              <li
                className="flex items-center justify-between text-sm"
                key={e.epicId}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${RISK_DOT[e.rag === "RED" ? "RED" : "AMBER"]}`}
                  />
                  {e.title}
                </span>
                <span className="text-muted-foreground">
                  due {fmt(e.dueDate)} · forecast {fmt(e.p85Date)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No epics currently at risk.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
