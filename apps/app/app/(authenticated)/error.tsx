"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useEffect } from "react";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h2 className="font-semibold text-lg">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
