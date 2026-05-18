"use client";

import { useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { markAllAsRead } from "../../../actions/notifications/index";
import { CheckCheckIcon, LoaderIcon } from "lucide-react";

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await markAllAsRead();
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending} className="gap-2">
      {isPending ? (
        <LoaderIcon className="size-4 animate-spin" />
      ) : (
        <CheckCheckIcon className="size-4" />
      )}
      Marcar todas como lidas
    </Button>
  );
}
