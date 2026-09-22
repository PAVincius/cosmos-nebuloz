import { useEffect, useState } from "react";

/** Quanto tempo "Salvo" fica visível antes de sumir. */
export const DURACAO_DO_SALVO_MS = 3000;

/**
 * `true` por alguns segundos depois de cada gravação que deu certo.
 *
 * Para autosave sem botão — a folha de readiness grava a cada nível clicado —
 * quem responde precisa de um "Salvo" discreto que aparece e some, não de um
 * status permanente. `gravacoes` é um contador que sobe a cada sucesso: cada
 * subida reinicia o relógio. Mesma ideia do `useSalvoHaPouco` do gerador de
 * proposta, que deriva o sucesso das transições de `salvando`/`sujo`; aqui a
 * gravação é explícita e o contador basta.
 */
export function useSalvoHaPouco(gravacoes: number): boolean {
  const [salvo, setSalvo] = useState(false);
  useEffect(() => {
    if (gravacoes === 0) {
      return;
    }
    setSalvo(true);
    const id = setTimeout(() => setSalvo(false), DURACAO_DO_SALVO_MS);
    return () => clearTimeout(id);
  }, [gravacoes]);
  return salvo;
}
