"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { XIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";

const SPRING_EASE = [0.2, 0.7, 0.3, 1] as const;

const SIZE_WIDTH: Record<"md" | "lg", number> = {
  md: 520,
  lg: 880,
};

export type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  /** Rendered as the modal's main heading (`.modal-title`). */
  title: string;
  /** Rendered as the subtitle under the title (`.modal-sub`). */
  eyebrow?: string;
  /** Form body. Ignored (skeleton shown instead) while `loading` is true. */
  children: ReactNode;
  /** Right-aligned action bar (e.g. Cancel/Submit). Footer bar is hidden if omitted. */
  footer?: ReactNode;
  /** Fixed modal width — `lg` (880px) matches the standard creation/edit modal, `md` (520px) fits simpler picker-style bodies. Defaults to `lg`. */
  size?: "md" | "lg";
  /** Swaps the body for a shimmer skeleton (used e.g. when re-rendering the form pane after a template switch). */
  loading?: boolean;
};

function FormSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            className="cosmos-modal-shimmer"
            style={{ height: 11, width: 110, borderRadius: 6 }}
          />
          <span
            className="cosmos-modal-shimmer"
            style={{ height: 38, width: "100%", borderRadius: "var(--cosmos-r-md)" }}
          />
        </div>
      ))}
    </div>
  );
}

export function ModalShell({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = "lg",
  loading = false,
}: ModalShellProps) {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      <style>{`
        @keyframes cosmos-modal-shimmer-sweep {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        .cosmos-modal-shimmer {
          display: block;
          background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%);
          background-size: 200% 100%;
          animation: cosmos-modal-shimmer-sweep 1.1s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cosmos-modal-shimmer { animation: none; }
        }
      `}</style>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeOut" }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "grid",
              placeItems: "center",
              padding: 32,
              background:
                "radial-gradient(120% 90% at 50% 0%, rgba(var(--accent-rgb),.10), transparent 55%), rgba(3,5,10,.68)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cosmos-modal-title"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.32, ease: SPRING_EASE }
              }
              style={{
                width: SIZE_WIDTH[size],
                maxWidth: "100%",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: "var(--cosmos-r-xl)",
                border: "1px solid var(--hairline-strong)",
                background: "var(--surface)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,.08) inset, 0 40px 90px -30px rgba(0,0,0,.95), 0 0 0 1px rgba(0,0,0,.4)",
              }}
            >
              {/* head */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "18px 20px",
                  background:
                    "linear-gradient(180deg, var(--surface-4) 0%, var(--surface-3) 40%, var(--surface-2) 100%)",
                  borderBottom: "1px solid var(--hairline)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,.09) inset, 0 16px 30px -18px rgba(0,0,0,.95)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    id="cosmos-modal-title"
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      letterSpacing: "-.02em",
                      color: "var(--ink)",
                    }}
                  >
                    {title}
                  </div>
                  {eyebrow ? (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-subtle)",
                        marginTop: 2,
                      }}
                    >
                      {eyebrow}
                    </div>
                  ) : null}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 32,
                      height: 32,
                      borderRadius: "var(--cosmos-r-sm)",
                      color: "var(--ink-subtle)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface-2)",
                      transition: "all .15s",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "var(--red-soft)";
                      event.currentTarget.style.color = "var(--red-text)";
                      event.currentTarget.style.borderColor = "rgba(var(--red-rgb),.3)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "var(--surface-2)";
                      event.currentTarget.style.color = "var(--ink-subtle)";
                      event.currentTarget.style.borderColor = "var(--hairline)";
                    }}
                  >
                    <XIcon size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* body */}
              <div
                style={{
                  padding: "20px 22px",
                  overflowY: "auto",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {loading ? <FormSkeleton /> : children}
              </div>

              {/* foot */}
              {footer ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 20px",
                    background: "linear-gradient(180deg,var(--surface-2),var(--surface))",
                    borderTop: "1px solid var(--hairline)",
                    boxShadow: "0 -1px 0 rgba(255,255,255,.04) inset",
                  }}
                >
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{footer}</div>
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
