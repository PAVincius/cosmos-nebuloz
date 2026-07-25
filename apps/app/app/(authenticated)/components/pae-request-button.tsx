"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import type { EntityType, PolicyAction } from "@/app/actions/permissions";
import { PAERequestSheet } from "./pae-request-sheet";

type PAERequestButtonProps = {
  entityType: EntityType;
  action: PolicyAction;
  targetEntityId?: string;
  label?: string;
  className?: string;
};

export function PAERequestButton({
  entityType,
  action,
  targetEntityId,
  label,
  className,
}: PAERequestButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className={className}
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
      >
        <LockIcon className="mr-1.5 h-3.5 w-3.5" />
        {label ?? "Solicitar Acesso"}
      </Button>
      <PAERequestSheet
        action={action}
        entityType={entityType}
        onOpenChange={setOpen}
        open={open}
        targetEntityId={targetEntityId}
      />
    </>
  );
}
