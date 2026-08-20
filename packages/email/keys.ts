import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      RESEND_FROM: z.string().email(),
      // Opcional porque em desenvolvimento o email vai para o catcher local e
      // não existe token nenhum. A exigência não sumiu — mudou de lugar:
      // `escolherTransporte` recusa quando não há catcher **nem** token, com
      // mensagem que diz as duas saídas. Aqui a falha seria "Invalid
      // environment variables" sem dizer o que fazer.
      RESEND_TOKEN: z.string().startsWith("re_").optional(),
      /** `smtp://host:porta` do catcher local. Vence o Resend quando presente. */
      MAIL_CATCHER_SMTP: z.string().startsWith("smtp://").optional(),
    },
    runtimeEnv: {
      RESEND_FROM: process.env.RESEND_FROM,
      RESEND_TOKEN: process.env.RESEND_TOKEN,
      MAIL_CATCHER_SMTP: process.env.MAIL_CATCHER_SMTP,
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
