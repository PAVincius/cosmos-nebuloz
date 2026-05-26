import { Badge } from "@repo/design-system/components/ui/badge";
import type { SAFeRole } from "@/app/actions/safe-copilot/roles/detect-role";

const ROLE_CONFIG: Record<SAFeRole, { label: string; className: string }> = {
  RTE: {
    label: "RTE",
    className: "border-purple-300 bg-purple-100 text-purple-700",
  },
  LPM: { label: "LPM", className: "border-blue-300 bg-blue-100 text-blue-700" },
  PO: {
    label: "PO",
    className: "border-emerald-300 bg-emerald-100 text-emerald-700",
  },
  SM: {
    label: "SM",
    className: "border-amber-300 bg-amber-100 text-amber-700",
  },
  DEV: {
    label: "Dev",
    className: "border-slate-300 bg-slate-100 text-slate-600",
  },
};

type Props = {
  role: SAFeRole;
};

export function CopilotRoleBadge({ role }: Props) {
  const config = ROLE_CONFIG[role];
  return (
    <Badge
      className={`px-1.5 py-0 font-semibold text-[10px] ${config.className}`}
      title={`Modo Copilot: ${config.label}`}
      variant="outline"
    >
      {config.label}
    </Badge>
  );
}
