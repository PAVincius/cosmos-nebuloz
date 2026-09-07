"use client";

import { useState } from "react";

/**
 * Barreira antes de operação sem volta.
 *
 * O painel provisiona tenant e suspende módulo de cliente — operações que
 * chegam ao cliente em segundos e não têm desfazer. Antes disto, todas eram um
 * clique.
 *
 * Três escolhas que fazem a barreira valer alguma coisa:
 *
 * 1. **O alvo aparece escrito.** "Tem certeza?" é a pergunta que se aprende a
 *    responder sim sem ler; "Cancelar COSMOS de vanta-saude" obriga a
 *    reconhecer o cliente. Se a pessoa abriu a aba errada, é aqui que ela vê.
 * 2. **A confirmação não nasce sob o cursor.** Botão de confirmar no lugar do
 *    gatilho é o mesmo clique com um passo a mais.
 * 3. **A consequência é escrita em prosa**, não deduzida do nome da ação.
 *
 * Não é `window.confirm`: aquele é dispensável por hábito, não diz o alvo e
 * some do teste.
 */
export function ConfirmarAcao({
  rotulo,
  alvo,
  consequencia,
  onConfirmar,
  executando = false,
  desabilitado = false,
}: {
  /** O que o botão faz, em imperativo: "Cancelar COSMOS". */
  rotulo: string;
  /** Quem sofre a ação — slug ou nome do cliente. */
  alvo: string;
  /** O que acontece depois, em uma frase. */
  consequencia: string;
  onConfirmar: () => void;
  /** Só verdadeiro enquanto a ação está de fato rodando — troca o rótulo do
   *  botão para "Executando…". */
  executando?: boolean;
  /** Desabilita o botão sem nada estar rodando — ex.: formulário incompleto.
   *  Separado de `executando` porque as duas coisas viram estados visuais
   *  diferentes: um botão cinza não é a mesma mensagem que "Executando…". */
  desabilitado?: boolean;
}) {
  const [perguntando, setPerguntando] = useState(false);
  const bloqueado = executando || desabilitado;

  const BOTAO = {
    padding: "5px 11px",
    borderRadius: "var(--r-sm)",
    border: "1px solid var(--hairline)",
    background: "none",
    fontSize: "var(--fs-nota)",
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  if (!perguntando) {
    return (
      <button
        className="btn"
        disabled={bloqueado}
        onClick={() => setPerguntando(true)}
        style={{
          ...BOTAO,
          color: "var(--red-text)",
          opacity: bloqueado ? 0.5 : 1,
          cursor: bloqueado ? "not-allowed" : "pointer",
        }}
        type="button"
      >
        {rotulo}
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--red-border, var(--hairline-strong))",
        background: "var(--red-soft, var(--surface-2))",
      }}
    >
      <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
        {rotulo} — <span className="mono">{alvo}</span>
      </span>
      <span style={{ fontSize: "var(--fs-nota)", color: "var(--ink-muted)" }}>
        {consequencia}
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {/* Voltar vem primeiro: o dedo que veio do gatilho encontra a saída,
            não a confirmação. */}
        <button
          className="btn"
          onClick={() => setPerguntando(false)}
          style={{ ...BOTAO, color: "var(--ink-muted)" }}
          type="button"
        >
          Voltar
        </button>
        <button
          className="btn"
          disabled={bloqueado}
          onClick={onConfirmar}
          style={{
            ...BOTAO,
            color: "var(--red-text)",
            opacity: bloqueado ? 0.5 : 1,
          }}
          type="button"
        >
          {executando ? "Executando…" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
