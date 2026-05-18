"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

// biome-ignore lint/suspicious/noExplicitAny: TS2742 — better-auth deep type inference crosses package boundary
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
}) as unknown as ReturnType<typeof createAuthClient> & {
  twoFactor: {
    enable: (opts: { password: string }) => Promise<{ data: { totpURI: string; backupCodes: string[] } | null; error: unknown }>;
    disable: (opts: { password: string }) => Promise<unknown>;
    verifyTotp: (opts: { code: string }) => Promise<unknown>;
  };
};

export const { signIn, signOut, signUp, useSession, getSession } = authClient;
