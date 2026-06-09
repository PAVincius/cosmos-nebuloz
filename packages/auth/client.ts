"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
}) as unknown as ReturnType<typeof createAuthClient> & {
  twoFactor: {
    enable: (opts: { password: string }) => Promise<{
      data: { totpURI: string; backupCodes: string[] } | null;
      error: unknown;
    }>;
    disable: (opts: { password: string }) => Promise<unknown>;
    verifyTotp: (opts: { code: string }) => Promise<unknown>;
  };
};

export const { signIn, signOut, signUp, useSession, getSession } = authClient;
