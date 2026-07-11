"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  ROAM_LABELS,
  ROAM_STATUSES,
  ROAM_TONE,
  type RoamStatus,
  toneStyleVars,
} from "./roam-constants";

type Props = {
  status: string;
  disabled?: boolean;
  onChange: (status: RoamStatus) => void;
};

/** Badge ROAM clicável — troca de status inline preserva a mutação real
 * (updateRiskStatus) que o quadro anterior fazia via drag-and-drop. */
export function RoamStatusSelect({ status, disabled, onChange }: Props) {
  const tone = ROAM_TONE[status as RoamStatus] ?? "neutral";
  const { bg, text, border } = toneStyleVars(tone);

  return (
    <Select
      disabled={disabled}
      onValueChange={(value) => onChange(value as RoamStatus)}
      value={status}
    >
      <SelectTrigger
        aria-label="Status ROAM"
        className="h-auto w-auto gap-1 rounded-pill border px-[9px] py-[3px] font-bold text-[11.5px] tracking-[.01em] [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60"
        style={{ background: bg, color: text, borderColor: border }}
      >
        <SelectValue>{ROAM_LABELS[status as RoamStatus] ?? status}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROAM_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {ROAM_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
