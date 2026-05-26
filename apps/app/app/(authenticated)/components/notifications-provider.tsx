"use client";

import { NotificationsProvider as RawNotificationsProvider } from "@repo/notifications/components/provider";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

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

  useEffect(() => {
    setTheme((resolvedTheme as "light" | "dark") ?? "light");
  }, [resolvedTheme]);

  return (
    <RawNotificationsProvider theme={theme} userId={userId}>
      {children}
    </RawNotificationsProvider>
  );
};
