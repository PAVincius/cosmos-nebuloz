import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      ARCJET_KEY: z.string().startsWith("ajkey_").optional(),
      ENCRYPTION_KEY: z.string().min(32),
    },
    runtimeEnv: {
      ARCJET_KEY: process.env.ARCJET_KEY,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    },
  });
