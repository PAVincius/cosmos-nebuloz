"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckCheckIcon, LoaderIcon } from "lucide-react";
import { useTransition } from "react";
import { markAllAsRead } from "../../../actions/notifications/index";

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      await markAllAsRead();
    });
  };

  return (
    <Button
      className="gap-2"
      disabled={isPending}
      onClick={handleClick}
      size="sm"
      variant="outline"
    >
      {isPending ? (
        <LoaderIcon className="size-4 animate-spin" />
      ) : (
        <CheckCheckIcon className="size-4" />
      )}
      Marcar todas como lidas
    </Button>
  );
}
