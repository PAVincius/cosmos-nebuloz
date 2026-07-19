"use client";

// modal.tsx — tiny local modal system for screens (replaces the prototype's
// global useModal). Wrap a screen in <ModalProvider>; call useModal().open(node).
import { createContext, type ReactNode, useContext, useState } from "react";
import { createPortal } from "react-dom";

const ModalCtx = createContext<{
  open: (n: ReactNode) => void;
  close: () => void;
}>({ open: () => {}, close: () => {} });
export const useModal = () => useContext(ModalCtx);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  const close = () => setNode(null);
  return (
    <ModalCtx.Provider value={{ open: setNode, close }}>
      {children}
      {node !== null &&
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
            <div onClick={(e) => e.stopPropagation()}>{node}</div>
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
  width = 460,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  const { close } = useModal();
  return (
    <div
      style={{
        width,
        maxWidth: "92vw",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline-strong)",
        borderRadius: 18,
        boxShadow: "0 48px 96px -24px rgba(0,0,0,.7)",
        overflow: "hidden",
        animation: "cosmos-fadeIn .18s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 18px",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        {icon && (
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(var(--accent-rgb),.14)",
              border: "1px solid rgba(var(--accent-rgb),.25)",
              color: "var(--accent-text)",
            }}
          >
            {icon}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="display"
            style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>
              {subtitle}
            </div>
          )}
        </div>
        <button
          className="btn navitem"
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
        >
          ×
        </button>
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
