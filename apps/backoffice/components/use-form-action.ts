"use client";

import { useCallback, useState, useTransition } from "react";
import type { Result } from "@/lib/safe-action";

/**
 * Estado de um formulário que chama server action: pendente, erro, e o
 * desempacotamento do `Result<T>`.
 *
 * Existe pelo que faltava, não pela repetição. Seis telas de CRUD do painel
 * traziam de 5 a 8 `useState` e de 5 a 7 `setErro` cada uma, e **nenhuma** das
 * seis usava `useTransition` — zero ocorrências no app inteiro. Sem pendência
 * visível a pessoa clica de novo: em `criar` isso é registro duplicado, e o
 * teto de 120 req/min por pessoa transforma uma sequência de cliques ansiosos
 * numa recusa que parece bug de sessão.
 *
 * `useTransition` e não um `useState(false)` à mão porque a action roda no
 * servidor e o React já sabe quando ela terminou, incluindo o
 * `revalidatePath` que vem junto. Um booleano manual desliga quando a promessa
 * resolve e deixa a tela sem dado novo por mais um instante — piscada que
 * ninguém consegue reproduzir depois.
 *
 * Adotar tela a tela, quando cada uma for tocada por outro motivo. Não vale um
 * mutirão de refatoração.
 */
export function useFormAction() {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Roda a action e trata o `Result<T>`.
   *
   * `aoDarCerto` só é chamada quando `ok` é true, e recebe o dado já estreitado
   * — é o que impede o `res.data` acessado no ramo de erro, que o TypeScript
   * pega mas só se alguém escrever o `if` na ordem certa.
   *
   * Erro inesperado (a action lançou em vez de devolver `Result`) vira mensagem
   * em vez de promessa rejeitada sem dono. `safeAction` já cobre o caminho do
   * servidor; isto cobre o que estoura antes dele, como a rede.
   */
  const executar = useCallback(
    <T>(acao: () => Promise<Result<T>>, aoDarCerto?: (dado: T) => void) => {
      setErro(null);
      iniciar(async () => {
        try {
          const res = await acao();
          if (res.ok) {
            aoDarCerto?.(res.data);
            return;
          }
          setErro(res.error);
        } catch {
          setErro("Não foi possível concluir a operação.");
        }
      });
    },
    []
  );

  const limparErro = useCallback(() => setErro(null), []);

  return { pendente, erro, executar, limparErro };
}
