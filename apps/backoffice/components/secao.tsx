import { SectionCard } from "@repo/design-system/cosmos/kit";
import type { ComponentProps } from "react";

/**
 * O `SectionCard` do painel, com o título como heading.
 *
 * O kit deixa `as` opcional e padrão `div` para Cosmos e Charter não mudarem;
 * aqui todo cartão é uma seção da tela, e sem `h2` o leitor de tela não tem
 * como pular de uma para a outra — 63 dos 83 cartões ainda eram `<div>`.
 * `as="h3"` fica para o cartão aninhado dentro de outro.
 */
export function Secao({
  as = "h2",
  ...props
}: Omit<ComponentProps<typeof SectionCard>, "as"> & { as?: "h2" | "h3" }) {
  return <SectionCard as={as} {...props} />;
}
