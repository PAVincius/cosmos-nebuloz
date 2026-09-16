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
 *
 * Dois tons: `red` para o que apaga ou cancela (o gatilho é um botão fantasma
 * vermelho — o padrão, porque todos os usos que existiam eram destrutivos);
 * `accent` para o que é sem volta mas não destrói — enviar proposta,
 * provisionar tenant, concluir avaliação. Nesse caso o gatilho é a ação
 * primária da tela, com o mesmo visual do `BotaoPrimario`: a barreira não
 * pode rebaixar o botão principal a um link cinza.
 */

type Tom = "accent" | "red";

const PALETA: Record<
  Tom,
  { texto: string; moldura: string; fundo: string; solido: boolean }
> = {
  accent: {
    texto: "var(--accent-text)",
    moldura: "1px solid rgba(var(--accent-rgb),.35)",
    fundo: "var(--accent-soft)",
    solido: true,
  },
  red: {
    texto: "var(--red-text)",
    moldura: "1px solid rgba(var(--red-rgb),.3)",
    fundo: "var(--red-soft)",
    solido: false,
  },
};

/** Botão fantasma compacto — o do tom vermelho e o "Voltar". */
const FANTASMA = {
  padding: "5px 11px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "none",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
} as const;

/** Ação primária — mesmo visual do `BotaoPrimario` de `campo.tsx`. */
const SOLIDO = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "9px 15px",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--accent-fg)",
  fontSize: "var(--fs-forte)",
  fontWeight: 600,
  fontFamily: "inherit",
  boxShadow:
    "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)",
  cursor: "pointer",
} as const;

export function ConfirmarAcao({
  rotulo,
  alvo,
  consequencia,
  onConfirmar,
  executando = false,
  desabilitado = false,
  tom = "red",
  aberto = false,
  onVoltar,
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
  /** `red` (padrão) para o que apaga ou cancela; `accent` para o que é sem
   *  volta mas não destrói — e aí o gatilho é a ação primária da tela. */
  tom?: Tom;
  /** Começa já perguntando. Para quando o gatilho aconteceu fora do
   *  componente — um `<select>` que mudou, um chip que foi clicado — e um
   *  segundo botão só para chegar à pergunta seria um passo a mais. */
  aberto?: boolean;
  /** Chamado ao desistir. Quem montou com `aberto` usa isto para restaurar o
   *  valor anterior. */
  onVoltar?: () => void;
}) {
  const [perguntando, setPerguntando] = useState(aberto);
  const bloqueado = executando || desabilitado;
  const paleta = PALETA[tom];

  const gatilho = paleta.solido
    ? { ...SOLIDO }
    : { ...FANTASMA, color: paleta.texto };

  if (!perguntando) {
    return (
      <button
        className="btn"
        disabled={bloqueado}
        onClick={() => setPerguntando(true)}
        style={{
          ...gatilho,
          opacity: bloqueado ? 0.5 : 1,
          cursor: bloqueado ? "not-allowed" : "pointer",
        }}
        type="button"
      >
        {rotulo}
      </button>
    );
  }

  const voltar = () => {
    setPerguntando(false);
    onVoltar?.();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        border: paleta.moldura,
        background: paleta.fundo,
      }}
    >
      <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
        {rotulo} — <span className="mono">{alvo}</span>
      </span>
      <span style={{ fontSize: "var(--fs-nota)", color: "var(--ink-muted)" }}>
        {consequencia}
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Voltar vem primeiro: o dedo que veio do gatilho encontra a saída,
            não a confirmação. */}
        <button
          className="btn"
          onClick={voltar}
          style={{ ...FANTASMA, color: "var(--ink-muted)" }}
          type="button"
        >
          Voltar
        </button>
        <button
          className="btn"
          disabled={bloqueado}
          onClick={onConfirmar}
          style={{
            ...gatilho,
            opacity: bloqueado ? 0.5 : 1,
            cursor: bloqueado ? "not-allowed" : "pointer",
          }}
          type="button"
        >
          {executando ? "Executando…" : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
