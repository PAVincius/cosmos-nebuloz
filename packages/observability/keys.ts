import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      BETTERSTACK_API_KEY: z.string().optional(),
      BETTERSTACK_URL: z.url().optional(),

      // Added by Sentry Integration, Vercel Marketplace
      SENTRY_ORG: z.string().optional(),
      SENTRY_PROJECT: z.string().optional(),
    },
    client: {
      // Added by Sentry Integration, Vercel Marketplace
      NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
    },
    runtimeEnv: {
      BETTERSTACK_API_KEY: process.env.BETTERSTACK_API_KEY,
      BETTERSTACK_URL: process.env.BETTERSTACK_URL,
      SENTRY_ORG: process.env.SENTRY_ORG,
      SENTRY_PROJECT: process.env.SENTRY_PROJECT,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    },
    // O build de CI não tem os segredos de runtime e não precisa deles: ele
    // compila, não executa. O job já define SKIP_ENV_VALIDATION há tempos —
    // nenhum módulo de env lia a variável, então a flag não fazia nada e o
    // build morria em BETTER_AUTH_SECRET ausente.
    //
    // Só vale quando a variável está explicitamente ligada; em runtime ela não
    // está, e a validação continua valendo como sempre.
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
