/** O que um cadastro self-service ganha. TRIAL com prazo, não ACTIVE: quem se
 *  cadastra sozinho não fechou venda. Trocar aqui muda o produto inteiro.
 *
 *  Mora fora de `onboarding.ts` porque aquele arquivo é `"use server"`, e um
 *  arquivo assim só pode exportar função async. Exportar a constante de lá
 *  derrubava a tela inteira em produção com "A `use server` file can only
 *  export async functions, found object" — erro que o Next mostra ao usuário
 *  como falha genérica de render, sem dizer a causa.
 */
const TRIAL_DAYS = 14;

export const SELF_SERVICE_MODULES = [
  {
    module: "COSMOS" as const,
    status: "TRIAL" as const,
    trialDays: TRIAL_DAYS,
  },
];
