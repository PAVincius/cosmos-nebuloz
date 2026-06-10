"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { NAV_BINDINGS, useKeyboardNav } from "@/app/hooks/use-keyboard-nav";

export function KeyboardProvider() {
  const { pendingPrefix, helpOpen, setHelpOpen } = useKeyboardNav();

  return (
    <>
      {/* Sequence indicator — appears when 'g' is pressed */}
      <AnimatePresence>
        {pendingPrefix && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="-translate-x-1/2 pointer-events-none fixed bottom-6 left-1/2 z-50"
            exit={{ opacity: 0, y: 4 }}
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-sm shadow-lg"
              style={{
                backgroundColor: "var(--surface-2)",
                borderColor: "var(--cosmos-ai-border)",
                color: "var(--cosmos-ai-fg)",
              }}
            >
              <kbd className="rounded border border-current/30 bg-black/20 px-1.5 py-0.5 text-[11px]">
                g
              </kbd>
              <span className="text-foreground/50">→</span>
              <span className="text-[12px] text-muted-foreground">
                {NAV_BINDINGS.map((b) => b.key).join(" · ")}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help modal — toggle with ? */}
      <Dialog onOpenChange={setHelpOpen} open={helpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                ?
              </kbd>
              Atalhos de teclado
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <section>
              <p className="mb-2 text-[11px] text-muted-foreground uppercase tracking-wider">
                Navegação (g → tecla)
              </p>
              <div className="flex flex-col gap-1">
                {NAV_BINDINGS.map((b) => (
                  <div
                    className="flex items-center justify-between"
                    key={b.key}
                  >
                    <span className="text-sm">{b.label}</span>
                    <div className="flex items-center gap-1">
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        g
                      </kbd>
                      <span className="text-muted-foreground text-xs">→</span>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {b.key}
                      </kbd>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <p className="mb-2 text-[11px] text-muted-foreground uppercase tracking-wider">
                Geral
              </p>
              <div className="flex flex-col gap-1">
                {[
                  { label: "Paleta de comandos", keys: ["⌘", "K"] },
                  { label: "Atalhos de teclado", keys: ["?"] },
                ].map(({ label, keys }) => (
                  <div
                    className="flex items-center justify-between"
                    key={label}
                  >
                    <span className="text-sm">{label}</span>
                    <div className="flex items-center gap-0.5">
                      {keys.map((k) => (
                        <kbd
                          className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                          key={k}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
