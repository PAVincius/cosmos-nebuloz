import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url().optional(),
    },
    client: {},
    runtimeEnv: {
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
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
