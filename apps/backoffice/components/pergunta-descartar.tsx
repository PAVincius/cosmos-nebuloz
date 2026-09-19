"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Pergunta inline antes de jogar fora um rascunho.
 *
 * Vivia duplicada em `ip/biblioteca.tsx` e `ferramentas/estudio.tsx` (trocar
 * de item com edição pendente); a crítica rodada 2 achou cinco diálogos Radix
 * que descartavam no Esc e no clique fora sem perguntar, e três telas que
 * deixavam fechar a aba. Uma implementação só, e as duas cópias somem.
 *
 * Mesma prosa e mesma ordem de `confirmar-acao.tsx`: o alvo escrito quando há
 * um (`nome`), "Voltar" antes de "Descartar". Não é `window.confirm`: aquele é
 * dispensável por hábito, não diz o alvo e some do teste.
 */

const BOTAO = {
  padding: "5px 11px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "none",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  cursor: "pointer",
} as const;

export function PerguntaDescartar({
  nome,
  explicacao = "O que você editou e ainda não salvou some. Para manter, volte e salve uma revisão antes de trocar.",
  onVoltar,
  onDescartar,
}: {
  /** O item com edição pendente. Sem nome, a pergunta é sobre o que foi
   *  digitado — o caso dos diálogos de criar. */
  nome?: string;
  explicacao?: string;
  onVoltar: () => void;
  onDescartar: () => void;
}) {
  // A pergunta aparece no lugar do que a pessoa acabou de clicar (outro item,
  // o X do diálogo, o seletor de período), e o foco ficava lá fora. Mesmo
  // padrão da `ConfirmarAcao`: ao montar, "Voltar" (a saída vem primeiro);
  // ao desmontar, de volta a quem tinha o foco — se ainda estiver na tela.
  const voltarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const anterior = document.activeElement;
    voltarRef.current?.focus();
    return () => {
      if (anterior instanceof HTMLElement && anterior.isConnected) {
        anterior.focus();
      }
    };
  }, []);

  // `fieldset` (group) nomeado pela pergunta e descrito pela explicação:
  // quem chega por leitor de tela ouve o que está prestes a perder antes de
  // "Voltar, botão".
  const idDaPergunta = useId();
  const idDaExplicacao = useId();

  return (
    <fieldset
      aria-describedby={idDaExplicacao}
      aria-labelledby={idDaPergunta}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: 0,
        minWidth: 0,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--red-border, var(--hairline-strong))",
        background: "var(--red-soft, var(--surface-2))",
      }}
    >
      <span
        id={idDaPergunta}
        style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}
      >
        {nome
          ? `Descartar alterações em «${nome}»?`
          : "Descartar o que foi digitado?"}
      </span>
      <span
        id={idDaExplicacao}
        style={{ fontSize: "var(--fs-nota)", color: "var(--ink-muted)" }}
      >
        {explicacao}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn"
          onClick={onVoltar}
          ref={voltarRef}
          style={{ ...BOTAO, color: "var(--ink-muted)" }}
          type="button"
        >
          Voltar
        </button>
        <button
          className="btn"
          onClick={onDescartar}
          style={{ ...BOTAO, color: "var(--red-text)" }}
          type="button"
        >
          Descartar
        </button>
      </div>
    </fieldset>
  );
}

/** A explicação dos diálogos de criar: não há revisão para salvar, só o
 *  formulário. */
export const EXPLICACAO_DO_DIALOGO =
  "O que você digitou some ao fechar. Para manter, volte e salve.";

/**
 * Guarda de fechamento de um diálogo Radix com rascunho.
 *
 * O `onOpenChange(false)` do Radix chega no Esc, no clique fora e no X — e
 * fechava sempre. Com o rascunho reportado por `marcarSujo`, `pedirFechar`
 * segura o fechamento e liga `perguntando`; `voltar` esquece o pedido;
 * `descartar` fecha de fato. O formulário de dentro chama `onClose` direto só
 * depois de salvar, quando não há mais o que perder.
 */
export function useFecharComRascunho(onClose: () => void): {
  perguntando: boolean;
  marcarSujo: (sujo: boolean) => void;
  pedirFechar: () => void;
  voltar: () => void;
  descartar: () => void;
} {
  const [sujo, setSujo] = useState(false);
  const [perguntando, setPerguntando] = useState(false);

  const pedirFechar = useCallback(() => {
    if (sujo) {
      setPerguntando(true);
      return;
    }
    onClose();
  }, [sujo, onClose]);

  const voltar = useCallback(() => setPerguntando(false), []);

  const descartar = useCallback(() => {
    setPerguntando(false);
    setSujo(false);
    onClose();
  }, [onClose]);

  return { descartar, marcarSujo: setSujo, pedirFechar, perguntando, voltar };
}

/** O formulário de dentro do diálogo avisa a guarda quando o rascunho muda —
 *  e desliga ao desmontar, para o próximo aberto não nascer sujo. */
export function useRascunhoReportado(
  sujo: boolean,
  marcarSujo: (valor: boolean) => void
): void {
  useEffect(() => {
    marcarSujo(sujo);
    return () => marcarSujo(false);
  }, [sujo, marcarSujo]);
}

/** Rascunho ≠ estado inicial. Os formulários dos diálogos são objetos rasos
 *  de strings e booleanos com a mesma ordem de chaves, então a comparação
 *  serializada é exata e custa uma linha. */
export function rascunhoMudou<T extends object>(atual: T, inicial: T): boolean {
  return JSON.stringify(atual) !== JSON.stringify(inicial);
}
