"use client";

// modal.tsx — tiny local modal system for screens (replaces the prototype's
// global useModal). Wrap a screen in <ModalProvider>; call useModal().open(node).
//
// Acessibilidade vive AQUI, não em cada modal: são dezenas de telas abrindo
// ModalCard, e teclado é a diferença entre a tela ser operável sem mouse ou
// não. O provider trata Escape e o foco; o card declara a semântica de
// diálogo. Quem escreve um modal novo herda tudo sem saber que existe.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const ModalCtx = createContext<{
  open: (n: ReactNode) => void;
  close: () => void;
}>({ open: () => {}, close: () => {} });
export const useModal = () => useContext(ModalCtx);

/**
 * Nó DOM do diálogo aberto, para quem precisa escapar do `overflow: hidden`
 * do ModalCard sem escapar do Tab-trap.
 *
 * ModalCard corta o que ultrapassa sua altura — é o que faz o border-radius
 * funcionar no conteúdo com scroll. Um dropdown como o do EntityLinkField,
 * `position: absolute` perto do fim do formulário, era cortado ali: o
 * quick-create existia mas ficava invisível. `position: fixed` sozinho não
 * resolve — `overflow: hidden` de um ancestral corta descendentes
 * independente de position. A única saída é um portal; e portar para
 * `document.body` sairia da árvore que o Tab-trap varre com
 * `dialogRef.current.querySelectorAll`. Portar para este nó em vez disso — o
 * mesmo `dialogRef` do provider — mantém o dropdown como irmão do ModalCard
 * (livre do overflow dele) e ainda dentro do que o Tab-trap considera.
 */
const ModalDialogNodeCtx = createContext<HTMLElement | null>(null);
export const useModalDialogNode = () => useContext(ModalDialogNodeCtx);

/** Focáveis dentro do diálogo, na ordem do DOM. */
const FOCUSAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Espelha dialogRef em state: o ref só populate depois do primeiro render,
  // e o contexto precisa disparar re-render de quem o consome quando o nó
  // aparece.
  const [dialogNode, setDialogNode] = useState<HTMLDivElement | null>(null);
  // Quem tinha o foco antes de abrir: devolver para lá no fechamento é o que
  // impede o teclado de voltar ao topo da página a cada modal.
  const origemDoFoco = useRef<Element | null>(null);

  const close = useCallback(() => setNode(null), []);
  const open = useCallback((n: ReactNode) => {
    origemDoFoco.current = document.activeElement;
    setNode(n);
  }, []);

  const aberto = node !== null;

  useEffect(() => {
    if (!aberto) {
      // Devolve o foco a quem abriu — se o elemento ainda existe na página.
      const alvo = origemDoFoco.current;
      if (alvo instanceof HTMLElement && document.contains(alvo)) {
        alvo.focus();
      }
      return;
    }

    // Primeiro campo do formulário, não o botão de fechar: abrir um modal e
    // já poder digitar é o que faz o teclado valer a pena. O × está antes no
    // DOM (vive no cabeçalho), então é excluído daqui — mas segue no ciclo
    // do Tab abaixo.
    const dialog = dialogRef.current;
    const primeiro = dialog?.querySelector<HTMLElement>(
      `${FOCUSAVEIS.split(", ").join(":not([data-modal-close]), ")}:not([data-modal-close])`
    );
    (primeiro ?? dialog)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key !== "Tab") {
        return;
      }
      // Tab cicla dentro do diálogo: sem isto o foco escapa para a página
      // atrás do backdrop, onde nada é clicável mas tudo é tabulável.
      // `hidden`/`aria-hidden` em vez de offsetParent: layout não é medido em
      // ambiente de teste, e um ciclo de foco que só funciona no navegador é
      // um ciclo que ninguém verifica.
      const focaveis = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSAVEIS) ?? []
      ).filter(
        (el) =>
          !el.hasAttribute("hidden") &&
          el.getAttribute("aria-hidden") !== "true"
      );
      if (focaveis.length === 0) {
        return;
      }
      const primeiroEl = focaveis[0];
      const ultimoEl = focaveis.at(-1);
      if (!(primeiroEl && ultimoEl)) {
        return;
      }
      const ativo = document.activeElement;
      if (e.shiftKey && ativo === primeiroEl) {
        e.preventDefault();
        ultimoEl.focus();
      } else if (!e.shiftKey && ativo === ultimoEl) {
        e.preventDefault();
        primeiroEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    // A página atrás não rola enquanto o diálogo está aberto.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, close]);

  return (
    <ModalCtx.Provider value={{ open, close }}>
      {children}
      {aberto &&
        createPortal(
          <div
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 400,
              background: "rgba(4,6,14,.6)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              paddingTop: 90,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              ref={(el) => {
                dialogRef.current = el;
                setDialogNode(el);
              }}
            >
              <ModalDialogNodeCtx.Provider value={dialogNode}>
                {node}
              </ModalDialogNodeCtx.Provider>
            </div>
          </div>,
          document.body
        )}
    </ModalCtx.Provider>
  );
}

// Standard modal shell — header (icon + title + close) over body content.
export function ModalCard({
  icon,
  title,
  subtitle,
  children,
  footer,
  tone = "accent",
  width = 460,
  padded = true,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Barra fixa no rodapé — ações do modal e a dica de atalhos. */
  footer?: ReactNode;
  /** Cor do realce do cabeçalho. */
  tone?: string;
  width?: number;
  /** `false` quando o conteúdo é um ModalSplit, que traz o próprio padding. */
  padded?: boolean;
}) {
  const { close } = useModal();
  const tituloId = useId();
  const subtituloId = useId();
  return (
    <div
      aria-describedby={subtitle ? subtituloId : undefined}
      aria-labelledby={tituloId}
      aria-modal="true"
      role="dialog"
      style={{
        width,
        maxWidth: "92vw",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: "var(--r-xl)",
        boxShadow: "0 50px 90px -24px rgba(0,0,0,.65)",
        overflow: "hidden",
        animation: "cosmos-fadeIn .18s ease",
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 140px)",
      }}
      tabIndex={-1}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "20px 22px",
          borderBottom: "1px solid var(--hairline)",
          flexShrink: 0,
          // Realce por tone: o mesmo do design de referência, que dá ao
          // cabeçalho a cor da entidade sendo criada.
          background: `radial-gradient(120% 180% at 0% 0%, rgba(var(--${tone}-rgb),.12), transparent 60%), var(--surface-2)`,
        }}
      >
        {icon && (
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 40,
              height: 40,
              borderRadius: "var(--r-md)",
              flexShrink: 0,
              background: `var(--${tone}-soft)`,
              border: `1px solid rgba(var(--${tone}-rgb),.25)`,
              color: `var(--${tone}-text)`,
            }}
          >
            {icon}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="display"
            id={tituloId}
            style={{
              color: "var(--ink)",
              fontSize: 16.5,
              fontWeight: 700,
              letterSpacing: "-.01em",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              id={subtituloId}
              style={{
                color: "var(--ink-subtle)",
                fontSize: 12.5,
                lineHeight: 1.4,
                marginTop: 3,
                maxWidth: 520,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <button
          aria-label="Fechar"
          className="btn navitem"
          data-modal-close="true"
          // Fica fora do foco inicial (vem antes do formulário no DOM), mas
          // continua tabulável.
          onClick={close}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: "var(--ink-faint)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
          }}
          title="Fechar (Esc)"
          type="button"
        >
          ×
        </button>
      </div>
      <div
        className="scroll"
        style={{ minHeight: 0, overflowY: "auto", padding: padded ? 18 : 0 }}
      >
        {children}
      </div>
      {footer && (
        <div
          style={{
            alignItems: "center",
            borderTop: "1px solid var(--hairline)",
            display: "flex",
            flexShrink: 0,
            gap: 12,
            justifyContent: "space-between",
            padding: "12px 18px",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Modal de criação em duas colunas: preview ao vivo à esquerda, formulário à
 * direita.
 *
 * O preview não é enfeite — é o que responde "o que eu vou ter no fim disso"
 * enquanto a pessoa ainda está digitando, num formulário onde vários campos
 * (cor, tamanho, WSJF) só fazem sentido vistos aplicados. Em tela estreita as
 * colunas empilham com o preview em cima, porque ele é o resumo.
 */
export function ModalSplit({
  preview,
  children,
}: {
  preview: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: 0 }}>
      <div
        className="scroll"
        style={{
          background: "var(--surface-2)",
          borderRight: "1px solid var(--hairline)",
          flexShrink: 0,
          overflowY: "auto",
          padding: 20,
          width: 300,
        }}
      >
        <div
          className="mono"
          style={{
            alignItems: "center",
            color: "var(--ink-faint)",
            display: "flex",
            fontSize: 10,
            fontWeight: 700,
            gap: 6,
            letterSpacing: ".1em",
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              background: "var(--accent)",
              borderRadius: 99,
              boxShadow: "0 0 6px var(--accent)",
              height: 6,
              width: 6,
            }}
          />
          Preview ao vivo
        </div>
        {preview}
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
          padding: 22,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Dica de atalhos do rodapé — o par que todo modal do Cosmos aceita. */
export function ModalShortcutHint({ salvar = "salvar" }: { salvar?: string }) {
  return (
    <span
      style={{
        color: "var(--ink-faint)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 11,
        letterSpacing: ".02em",
      }}
    >
      {`esc cancelar · ⌘↵ ${salvar}`}
    </span>
  );
}

/**
 * ⌘↵ (ou Ctrl+Enter) dispara a ação principal de dentro de qualquer campo.
 *
 * Enter sozinho não serve: em textarea ele quebra linha, e em formulário com
 * vários campos submeteria antes da hora. O par com Escape é o que torna o
 * modal operável sem tirar as mãos do teclado.
 */
export function useModalSubmitShortcut(
  onSubmit: () => void,
  habilitado = true
) {
  useEffect(() => {
    if (!habilitado) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onSubmit, habilitado]);
}
