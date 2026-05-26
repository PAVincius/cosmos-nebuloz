"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useRouter, useSearchParams } from "next/navigation";
import type { FlowScopeOption } from "@/app/actions/flow-metrics";

type Props = {
  options: FlowScopeOption[];
};

export function FlowScopeSelector({ options }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const scopeType = params.get("scope") ?? "art";
  const scopeId = params.get("scopeId") ?? "";
  const current = `${scopeType}:${scopeId}`;

  function onChange(value: string) {
    const [type, id] = value.split(":");
    router.push(`?scope=${type}&scopeId=${id}`);
  }

  return (
    <Select onValueChange={onChange} value={current}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Selecionar escopo..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
            <span className="mr-1 text-muted-foreground text-xs">
              {o.type === "art" ? "ART" : "Time"}
            </span>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
