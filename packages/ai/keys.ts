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
    },
    runtimeEnv: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
      LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
      LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    },
  });
