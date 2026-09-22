"use client";

import { type ReactNode, useEffect } from "react";
import { useParamState } from "@/lib/url-state";
import { Confirmacao } from "./confirmacao";

/**
 * "Deu certo" que chega pela URL e sai dela depois de dito.
 *
 * O provisionamento termina em `/clientes/[slug]?criado=1`, e a tela abre
 * dizendo o nome do cliente que nasceu. Com o param parado na URL, cada F5 e
 * cada link copiado dali repetia "provisionado" sobre um cliente que existe há
 * dias. Aqui a frase fica na tela e o param some — no modo raso do
 * `url-state`, sem navegar: o servidor não re-renderiza e a frase não pisca.
 */
export function ConfirmacaoDeUmaVez({
  param,
  children,
}: {
  /** O param que trouxe a notícia. Só ele sai; os demais ficam. */
  param: string;
  children: ReactNode;
}) {
  const [valor, limpar] = useParamState(param);
  useEffect(() => {
    if (valor) {
      limpar("");
    }
  }, [valor, limpar]);

  return <Confirmacao>{children}</Confirmacao>;
}
