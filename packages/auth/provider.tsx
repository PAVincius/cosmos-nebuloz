"use client";

import type { PropsWithChildren } from "react";

type AuthProviderProperties = PropsWithChildren<{
  privacyUrl?: string;
  termsUrl?: string;
  helpUrl?: string;
}>;

export const AuthProvider = ({ children }: AuthProviderProperties) => {
  return <>{children}</>;
};
