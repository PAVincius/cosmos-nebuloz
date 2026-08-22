import { z } from "zod";

/**
 * Contrato do corpo da requisição do copiloto.
 *
 * Vive fora de `route.ts` porque um módulo de rota do App Router só pode
 * exportar os handlers e as opções de segmento — e este schema precisa ser
 * testável isoladamente. É o contrato de confiança da aplicação com o cliente;
 * merece teste próprio.
 */

/** Teto de mensagens por requisição.
 *
 *  Existe porque a quota conta **interação, não token**: sem teto no array, uma
 *  unidade de quota compra uma chamada de tamanho arbitrário, e o plano ORBIT
 *  (20 interações) pode custar o que 20 000 custariam. Cinquenta cobre
 *  conversa longa de verdade e ainda limita o pior caso a ~500 KB. */
export const MAX_MENSAGENS = 50;

/** Teto por mensagem, preservado do schema original. */
const MAX_CARACTERES = 10_000;

/**
 * Papéis que o cliente pode enviar.
 *
 * `system` fica de fora **de propósito**: instrução de sistema é da aplicação.
 * Com `role` livre, um POST com `{"role":"system"}` entrava na conversa como
 * instrução de sistema de verdade, com a mesma autoridade das regras do
 * produto. `tool` também fica de fora — resultado de ferramenta é produzido
 * aqui, nunca recebido de fora.
 */
const PAPEL_DE_MENSAGEM = ["user", "assistant"] as const;

export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(PAPEL_DE_MENSAGEM),
        content: z.string().max(MAX_CARACTERES),
      })
    )
    .min(1)
    .max(MAX_MENSAGENS),
  mode: z.string().optional(),
  surface: z.string().optional(),
  contextRef: z.record(z.string(), z.string()).optional(),
  sessionId: z.string().optional(),
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;
