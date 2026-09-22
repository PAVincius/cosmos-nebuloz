"use client";

import { useEffect, useId, useRef, useState } from "react";

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
  nomeDoGatilho,
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
  /** Nome acessível do gatilho, quando o rótulo sozinho se repete na tela —
   *  cinco "Excluir" numa lista soam iguais para o leitor de tela. Deve
   *  **conter** o rótulo visível ("Excluir lançamento Aluguel"), para quem
   *  comanda por voz dizer o que vê. Sem a prop, o nome é o rótulo. */
  nomeDoGatilho?: string;
}) {
  const [perguntando, setPerguntando] = useState(aberto);
  const bloqueado = executando || desabilitado;
  const paleta = PALETA[tom];
  // O bloco aberto é um `fieldset` (group) nomeado pelo rótulo e descrito
  // pelo alvo e pela consequência: quem chega por leitor de tela ouve do que
  // está desistindo antes de "Voltar, botão".
  const idDoRotulo = useId();
  const idDoAlvo = useId();
  const idDaConsequencia = useId();

  // O gatilho desmonta quando a pergunta abre, e o foco que estava nele cairia
  // no `body`: quem navega por teclado perdia o lugar no passo da decisão.
  // Abrir pelo gatilho foca "Voltar" (a saída vem primeiro); desistir devolve
  // o foco ao gatilho. Com `aberto` vindo de fora o gatilho foi um `<select>`
  // que ainda pode estar sendo navegado — aí ninguém rouba o foco dele.
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const voltarRef = useRef<HTMLButtonElement>(null);
  const deveFocar = useRef(false);

  useEffect(() => {
    if (!deveFocar.current) {
      return;
    }
    deveFocar.current = false;
    (perguntando ? voltarRef : gatilhoRef).current?.focus();
  }, [perguntando]);

  const gatilho = paleta.solido
    ? { ...SOLIDO }
    : { ...FANTASMA, color: paleta.texto };

  if (!perguntando) {
    return (
      <button
        aria-label={nomeDoGatilho}
        className="btn"
        disabled={bloqueado}
        onClick={() => {
          deveFocar.current = true;
          setPerguntando(true);
        }}
        ref={gatilhoRef}
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
    deveFocar.current = true;
    setPerguntando(false);
    onVoltar?.();
  };

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: o fieldset é o grupo da pergunta; o Esc chega por bubbling dos dois botões, que são os interativos.
    <fieldset
      aria-describedby={`${idDoAlvo} ${idDaConsequencia}`}
      aria-labelledby={idDoRotulo}
      // Esc é Voltar: quem chegou à pergunta por teclado sai dela como sai de
      // qualquer diálogo, sem ter de achar o botão. Só com o foco dentro do
      // bloco — um Esc solto na página não desiste de nada.
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          voltar();
        }
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: 0,
        minWidth: 0,
        padding: "10px 12px",
        borderRadius: "var(--r-md)",
        border: paleta.moldura,
        background: paleta.fundo,
      }}
    >
      <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
        <span id={idDoRotulo}>{rotulo}</span> —{" "}
        <span className="mono" id={idDoAlvo}>
          {alvo}
        </span>
      </span>
      <span
        id={idDaConsequencia}
        style={{ fontSize: "var(--fs-nota)", color: "var(--ink-muted)" }}
      >
        {consequencia}
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Voltar vem primeiro: o dedo que veio do gatilho encontra a saída,
            não a confirmação. */}
        <button
          className="btn"
          onClick={voltar}
          ref={voltarRef}
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
    </fieldset>
  );
}
