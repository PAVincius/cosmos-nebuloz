import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
      STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
    },
    runtimeEnv: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
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
