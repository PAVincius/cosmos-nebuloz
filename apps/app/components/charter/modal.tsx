"use client";

// modal.tsx — host e casca de modal do Charter. Port de `charter-modal.jsx`.
//
// Três coisas que o modal do Cosmos não faz e o Charter precisa:
//
//  1. **Confirmação de descarte.** Todo controle do form-kit marca o formulário
//     como sujo. Fechar com campo preenchido pergunta antes — num produto onde
//     o formulário vira registro de auditoria, perder digitação por clique no
//     backdrop custa caro.
//  2. **Header com tom.** Gradiente radial na cor do tom: um modal de bloqueio
//     precisa parecer bloqueio antes de o usuário ler o título.
//  3. **`ModalSplit`.** Formulário à esquerda, trilho de avaliação ao vivo à
//     direita, fixo. É o que faz o intake avaliar enquanto se preenche.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Button, IconButton, type Tone } from "@repo/design-system/cosmos/kit";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { DirtyCtx } from "./form-kit";
import { FS } from "./type-scale";

type ModalApi = { open: (n: ReactNode) => void; close: () => void };

const ModalCtx = createContext<ModalApi>({
  open: () => {
    /* noop até haver provider */
  },
  close: () => {
    /* noop até haver provider */
  },
});

export const useModal = () => useContext(ModalCtx);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  // Elemento que abriu o modal — o foco volta para ele no fechamento, senão
  // quem navega por teclado é jogado no topo do documento.
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback((n: ReactNode) => {
    opener.current = document.activeElement as HTMLElement | null;
    setContent(n);
  }, []);

  const close = useCallback(() => {
    setContent(null);
    opener.current?.focus?.();
    opener.current = null;
  }, []);

  return (
    <ModalCtx.Provider value={{ open, close }}>
      {children}
      <ModalHost content={content} onClose={close} />
    </ModalCtx.Provider>
  );
}

// Focáveis para o trap de Tab — mesmo critério do foco inicial do ModalShell.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function ModalHost({
  content,
  onClose,
}: {
  content: ReactNode;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const tryClose = useCallback(() => {
    if (dirty) {
      setConfirming(true);
    } else {
      setDirty(false);
      onClose();
    }
  }, [dirty, onClose]);

  useEffect(() => {
    if (!content) {
      setDirty(false);
      setConfirming(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        tryClose();
        return;
      }
      // Trap de Tab: sem isso o foco escapa do dialog para a página atrás.
      if (e.key === "Tab") {
        const dialog =
          wrapperRef.current?.querySelector<HTMLElement>('[role="dialog"]');
        const focusables = Array.from(
          dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
        );
        if (focusables.length === 0) {
          return;
        }
        const first = focusables[0];
        const last = focusables.at(-1) as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    // Trava o scroll do fundo: rolar a lista atrás do modal desorienta.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [content, tryClose]);

  if (!content) {
    return null;
  }

  return createPortal(
    <DirtyCtx.Provider value={{ markDirty: () => setDirty(true) }}>
      <div
        ref={wrapperRef}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          display: "grid",
          placeItems: "center",
          padding: 32,
        }}
      >
        {/* Backdrop como <button> ocupando a área toda, atrás do diálogo: o
            clique-para-fechar não precisa de handler num <div>, e quem usa
            teclado encontra um controle anunciado além do Esc. */}
        <button
          aria-label="Fechar modal"
          onClick={tryClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            border: "none",
            padding: 0,
            background: "var(--scrim)",
            backdropFilter: "blur(6px)",
            cursor: "default",
          }}
          tabIndex={-1}
          type="button"
        />
        {content}
        {confirming && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 310,
              display: "grid",
              placeItems: "center",
              background: "rgba(4,5,7,.55)",
              backdropFilter: "blur(3px)",
            }}
          >
            <div
              aria-labelledby="charter-discard-title"
              aria-modal="true"
              role="alertdialog"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: "var(--r-lg)",
                padding: "24px 28px",
                maxWidth: 380,
                boxShadow: "0 24px 48px -16px rgba(0,0,0,.6)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 11,
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: "var(--amber-soft)",
                    color: "var(--amber-text)",
                    border: "1px solid rgba(var(--amber-rgb),.25)",
                  }}
                >
                  <Icon name="alert" size={16} />
                </span>
                <div>
                  <div
                    className="display"
                    id="charter-discard-title"
                    style={{
                      fontSize: FS.forte,
                      fontWeight: 700,
                      marginBottom: 5,
                    }}
                  >
                    Descartar alterações?
                  </div>
                  <div
                    style={{
                      fontSize: FS.base,
                      color: "var(--ink-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    Este formulário tem campos preenchidos que ainda não foram
                    registrados na trilha de auditoria.
                  </div>
                </div>
              </div>
              <div
                style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
              >
                <Button
                  onClick={() => setConfirming(false)}
                  size="md"
                  variant="secondary"
                >
                  Continuar editando
                </Button>
                <Button
                  icon="x"
                  onClick={() => {
                    setDirty(false);
                    setConfirming(false);
                    onClose();
                  }}
                  size="md"
                  style={{
                    background: "var(--red)",
                    borderColor: "var(--red)",
                  }}
                >
                  Descartar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DirtyCtx.Provider>,
    document.body
  );
}

// ── ModalShell ────────────────────────────────────────────────────────────────

export function ModalShell({
  width = 880,
  icon,
  tone = "accent",
  title,
  subtitle,
  onClose,
  actions,
  children,
  footer,
}: {
  width?: number;
  icon?: IconName;
  tone?: Tone;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Foco no primeiro controle do corpo; sem isso o teclado começa no backdrop.
    const first = bodyRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, button, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, []);

  return (
    <div
      aria-label={title}
      aria-modal="true"
      role="dialog"
      style={{
        width,
        maxWidth: "94vw",
        maxHeight: "88vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: "var(--r-xl)",
        boxShadow: "0 50px 90px -24px rgba(0,0,0,.7)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
          padding: "20px 22px",
          borderBottom: "1px solid var(--hairline)",
          flexShrink: 0,
          background: `radial-gradient(120% 180% at 0% 0%, rgba(var(--${tone}-rgb),.13), transparent 60%), var(--surface-2)`,
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
              color: `var(--${tone}-text)`,
              border: `1px solid rgba(var(--${tone}-rgb),.25)`,
            }}
          >
            <Icon name={icon} size={19} strokeWidth={1.9} />
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="display"
            style={{
              fontSize: FS.titulo,
              fontWeight: 700,
              letterSpacing: "-.02em",
              color: "var(--ink)",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: FS.base,
                color: "var(--ink-muted)",
                marginTop: 3,
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {actions}
          <IconButton name="x" onClick={onClose} size={30} title="Fechar" />
        </div>
      </div>

      <div
        className="scroll"
        ref={bodyRef}
        style={{ overflowY: "auto", flex: 1, minHeight: 0 }}
      >
        {children}
      </div>

      {footer && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 20px",
            borderTop: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/** Dois painéis: formulário rolável à esquerda, trilho de avaliação ao vivo à
 *  direita. É o que faz o intake mostrar a consequência enquanto se digita. */
export function ModalSplit({
  aside,
  children,
  asideWidth = 300,
}: {
  aside: ReactNode;
  children: ReactNode;
  asideWidth?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `minmax(0,1fr) ${asideWidth}px`,
        minHeight: 0,
      }}
    >
      <div style={{ padding: 22, minWidth: 0 }}>{children}</div>
      <div
        style={{
          borderLeft: "1px solid var(--hairline)",
          background: "var(--surface-2)",
          padding: 18,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignSelf: "start",
          position: "sticky",
          top: 0,
        }}
      >
        {aside}
      </div>
    </div>
  );
}
