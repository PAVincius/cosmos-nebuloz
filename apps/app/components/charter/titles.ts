/**
 * Rótulos de cada tela do Charter: id → [título, seção].
 *
 * Mesmo motivo do irmão em `components/cosmos/titles.ts`: `shell.tsx` é
 * `"use client"`, o `generateMetadata` de
 * `app/(charter)/charter/[[...seg]]/page.tsx` é server, e um objeto importado
 * através dessa fronteira chega como referência de client — `TITLES[id]` vinha
 * `undefined` e toda aba do Charter lia o id cru.
 *
 * Sem `"use client"` aqui de propósito.
 */
export const TITLES: Record<string, [string, string]> = {
  dashboard: ["Visão Geral", "Governança"],
  policy: ["Políticas", "Governança"],
  cases: ["Casos de Uso", "Governança"],
  case: ["Caso de Uso", "Casos de Uso"],
  risk: ["Matriz de Risco", "Risco"],
  vendors: ["Fornecedores", "Risco"],
  vendor: ["Fornecedor", "Fornecedores"],
  onboarding: ["Onboarding", "Pessoas"],
  audit: ["Auditoria", "Evidência"],
  conformidade: ["Mapa de Conformidade", "Evidência"],
  settings: ["Configurações", "Charter"],
};
