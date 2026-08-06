/**
 * Constantes do comercial.
 *
 * Moram fora de `app/actions/proposals.ts` porque um módulo `"use server"` só
 * pode exportar função async — exportar uma const de lá quebra o build inteiro
 * do app, não só a action. Mesmo motivo de `lib/client-queries.ts`.
 */

/**
 * Acima deste percentual, a proposta não é enviada no clique: entra na fila de
 * PlatformApproval.
 *
 * Exportado porque a TELA também precisa dele — mostrar o limite enquanto a
 * pessoa monta a proposta evita descobrir o gate só no clique de enviar, depois
 * de o desconto já ter sido combinado com o cliente.
 *
 * Um número só, lido pelos dois lados. Duplicar entre tela e action é como o
 * gate se afrouxa sem ninguém decidir afrouxá-lo.
 */
export const LIMITE_DESCONTO_SEM_APROVACAO = 15;
