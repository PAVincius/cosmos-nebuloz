"use client";

import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  autosaveBusinessCase,
  getBusinessCase,
} from "@/app/actions/epics/business-case";

type Resolution = "VALIDATED" | "PARTIALLY_VALIDATED" | "INVALIDATED";

const RESOLUTION_LABELS: Record<Resolution, string> = {
  VALIDATED: "Validada",
  PARTIALLY_VALIDATED: "Parcialmente validada",
  INVALIDATED: "Invalidada",
};

const PLACEHOLDER =
  "Acreditamos que [resultado de negócio] resultará em [benefício]. Saberemos que é verdade quando [sinal mensurável].";

type Props = { epicId: string };

export function EpicDrawerHypothesis({ epicId }: Props) {
  const [hypothesis, setHypothesis] = useState<string>("");
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getBusinessCase(epicId).then((res) => {
      if (res.ok) {
        setHypothesis(res.data.hypothesis ?? "");
        setResolution((res.data.hypothesisResolution as Resolution) ?? null);
      }
      setLoading(false);
    });
  }, [epicId]);

  function scheduleSave(
    nextHypothesis: string,
    nextResolution: Resolution | null
  ) {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(async () => {
      const result = await autosaveBusinessCase({
        epicId,
        hypothesis: nextHypothesis || null,
        hypothesisResolution: nextResolution ?? null,
      });
      if (!result.ok) {
        toast.error("Erro ao salvar hipótese");
      }
    }, 1200);
  }

  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    },
    []
  );

  if (loading) {
    return <div className="p-6 text-muted-foreground text-sm">Carregando…</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="space-y-1.5">
        <Label htmlFor="hypothesis-text">Hipótese (SAFe 6.0)</Label>
        <Textarea
          className="min-h-[140px] resize-none text-sm"
          id="hypothesis-text"
          onChange={(e) => {
            setHypothesis(e.target.value);
            scheduleSave(e.target.value, resolution);
          }}
          placeholder={PLACEHOLDER}
          value={hypothesis}
        />
        <p className="text-[11px] text-muted-foreground">
          Formato:{" "}
          <em>
            Acreditamos que… resultará em… Saberemos que é verdade quando…
          </em>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hypothesis-resolution">Resultado da hipótese</Label>
        <Select
          onValueChange={(val) => {
            const next = val === "none" ? null : (val as Resolution);
            setResolution(next);
            scheduleSave(hypothesis, next);
          }}
          value={resolution ?? "none"}
        >
          <SelectTrigger className="w-56" id="hypothesis-resolution">
            <SelectValue placeholder="Não definido" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Não definido</SelectItem>
            {(Object.keys(RESOLUTION_LABELS) as Resolution[]).map((k) => (
              <SelectItem key={k} value={k}>
                {RESOLUTION_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
