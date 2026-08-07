import "server-only";

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      OPENAI_API_KEY: z.string().startsWith("sk-").optional(),
      ANTHROPIC_API_KEY: z.string().startsWith("sk-ant-").optional(),
      GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
      LANGFUSE_SECRET_KEY: z.string().startsWith("sk-lf-").optional(),
      LANGFUSE_PUBLIC_KEY: z.string().startsWith("pk-lf-").optional(),
      LANGFUSE_BASE_URL: z.string().url().optional(),
      /** Opt-in explícito para mandar prompt e resposta em claro ao Langfuse.
       *  Ausente = mascarado. Ligar só em ambiente sem dado de cliente real. */
      LANGFUSE_CAPTURE_CONTENT: z.enum(["true", "false"]).optional(),
    },
    runtimeEnv: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
      LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
      LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
      LANGFUSE_CAPTURE_CONTENT: process.env.LANGFUSE_CAPTURE_CONTENT,
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
