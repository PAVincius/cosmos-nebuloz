"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function MeetingSearchBar() {
  const router = useRouter();
  const params = useSearchParams();

  const onSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.trim();
      const next = new URLSearchParams(params.toString());
      if (val) {
        next.set("query", val);
      } else {
        next.delete("query");
      }
      router.replace(`/meetings?${next.toString()}`);
    },
    [router, params]
  );

  return (
    <Input
      className="max-w-sm"
      defaultValue={params.get("query") ?? ""}
      onChange={onSearch}
      placeholder="Buscar meetings..."
      type="search"
    />
  );
}
