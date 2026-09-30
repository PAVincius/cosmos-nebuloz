import type { IconName } from "@repo/design-system/cosmos/icons";
import { Badge } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";
import { SecaoSimples } from "./secao";

/** Seção de prontidão de um módulo: os selos do que já existe e, quando falta
 *  algo, o bootstrap que resolve.
 *
 *  Extraída da página porque a segunda cópia (Meridian, ao lado do Charter)
 *  levou a função da tela a 21 de complexidade — o teto é 15, e a terceira
 *  cópia teria vindo por copiar e colar, como esta veio. */
export function ProntidaoDoModulo({
  titulo,
  subtitulo,
  icone,
  selos,
  acao,
  extra,
}: {
  titulo: string;
  subtitulo: string;
  icone: IconName;
  selos: { rotulo: string; ok: boolean }[];
  /** Só aparece quando falta algo — a página decide. */
  acao: ReactNode;
  /** Cartão que vale sempre, com ou sem bootstrap pendente — ex.: o benchmark
   *  do Meridian. */
  extra?: ReactNode;
}) {
  return (
    <SecaoSimples icone={icone} subtitulo={subtitulo} titulo={titulo}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {selos.map((selo) => (
          <Badge dot key={selo.rotulo} tone={selo.ok ? "green" : "amber"}>
            {selo.rotulo}: {selo.ok ? "sim" : "não"}
          </Badge>
        ))}
      </div>
      {acao ? <div style={{ marginTop: 12 }}>{acao}</div> : null}
      {extra ? <div style={{ marginTop: 12 }}>{extra}</div> : null}
    </SecaoSimples>
  );
}

/** Cliente com tudo pronto não vê ação que não faz nada: o bootstrap só
 *  aparece com o módulo contratado e algum pré-requisito faltando. */
export function faltaPreparar(prontidao: {
  moduleContracted: boolean;
  requisitos: boolean[];
}): boolean {
  return prontidao.moduleContracted && !prontidao.requisitos.every((ok) => ok);
}
