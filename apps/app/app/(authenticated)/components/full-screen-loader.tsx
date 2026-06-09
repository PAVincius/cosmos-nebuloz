"use client";

type FullScreenLoaderProps = {
  message?: string;
};

export const FullScreenLoader = ({
  message = "Switching workspace…",
}: FullScreenLoaderProps) => (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/95 backdrop-blur-sm">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    <p className="text-muted-foreground text-sm">{message}</p>
  </div>
);
