"use client";

import { NotificationsProvider as RawNotificationsProvider } from "@repo/notifications/components/provider";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

type NotificationsProviderProperties = {
  children: ReactNode;
  userId: string;
};

export const NotificationsProvider = ({
  children,
  userId,
}: NotificationsProviderProperties) => {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  // mounted gate: prevents KnockProvider (SSR-incompatible) from creating
  // a different fiber tree depth on server vs client, which shifts Radix
  // useId() counters and causes hydration mismatches (same pattern as CopilotProvider).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((resolvedTheme as "light" | "dark") ?? "light");
  }, [resolvedTheme]);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <RawNotificationsProvider theme={theme} userId={userId}>
      {children}
    </RawNotificationsProvider>
  );
};
