"use client";

// palette.tsx — paleta ⌘K / Ctrl+K do Signal.
//
// Mesma anatomia da paleta do Cosmos (`components/cosmos/command-palette.tsx`),
// com a NAV do Signal. Não foi reusada diretamente porque aquela importa a NAV
// do Cosmos e monta sob `.cosmos-root` — o escopo do CSS erraria e a lista
// mostraria telas de outro produto.
//
// Autocontida: dona do próprio estado de abertura e do listener global, então
// montar <SignalPalette /> uma vez dentro do SignalShell basta.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { useNav } from "@repo/design-system/cosmos/kit";
import { Command } from "cmdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NAV } from "./shell";

type PaletteEntry = {
  id: string;
  label: string;
  parentLabel: string;
  icon: IconName;
};

function flattenNav(): PaletteEntry[] {
  return NAV.flatMap((section) =>
    section.items.map((item) => ({
      id: item.id,
      label: item.label,
      parentLabel: section.label,
      icon: item.icon,
    }))
  );
}

export function SignalPalette({ screenIds }: { screenIds: string[] }) {
  // Calculada com preguiça (não no load do módulo) para evitar o crash de
  // temporal dead zone: shell.tsx importa este módulo antes de inicializar o
  // próprio `NAV`.
  const entries = useMemo(() => flattenNav(), []);
  const [open, setOpen] = useState(false);
  const { navigate, isComingSoon } = useNav();
  // Quem abriu a paleta recebe o foco de volta ao fechar. Sem isto o foco cai
  // no <body> e o próximo Tab recomeça do topo da página.
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
    opener.current = null;
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((wasOpen) => {
          if (wasOpen) {
            opener.current?.focus();
            opener.current = null;
            return false;
          }
          opener.current = document.activeElement as HTMLElement | null;
          return true;
        });
        return;
      }
      if (e.key === "Escape") {
        setOpen((wasOpen) => {
          if (wasOpen) {
            opener.current?.focus();
            opener.current = null;
          }
          return false;
        });
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) {
    return null;
  }

  const handleSelect = (id: string) => {
    if (isComingSoon(id)) {
      return;
    }
    navigate(id);
    close();
  };

  return createPortal(
    <div
      className="signal-root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "var(--scrim)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 120,
      }}
    >
      {/* Fechar clicando fora é um BOTÃO de verdade, não um div com onClick: o
          div não recebe foco nem responde a Enter, e leitor de tela não anuncia
          nada. Fica fora da ordem de tabulação (Esc já é o caminho de teclado)
          e sem rótulo visível, mas nomeado para AT. */}
      <button
        aria-label="Fechar a paleta"
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "transparent",
          cursor: "default",
        }}
        tabIndex={-1}
        type="button"
      />
      <Command
        label="Navegação por comando"
        style={{
          position: "relative",
          width: 480,
          maxWidth: "92vw",
          background: "var(--surface-2)",
          border: "1px solid var(--hairline-strong)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--card-shadow)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <Icon name="search" size={16} style={{ color: "var(--ink-faint)" }} />
          <Command.Input
            autoFocus
            placeholder="Buscar tela..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--ink)",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              padding: "1px 5px",
              borderRadius: 4,
              background: "var(--surface-3)",
              border: "1px solid var(--hairline)",
              color: "var(--ink-subtle)",
            }}
          >
            ESC
          </span>
        </div>

        <Command.List
          className="scroll"
          style={{ maxHeight: 340, overflowY: "auto", padding: 8 }}
        >
          <Command.Empty
            style={{
              padding: "18px 12px",
              fontSize: 13,
              color: "var(--ink-faint)",
            }}
          >
            Nenhuma tela com esse nome.
          </Command.Empty>
          {entries.map((entry) => {
            const soon = !screenIds.includes(entry.id);
            return (
              <Command.Item
                disabled={soon}
                key={entry.id}
                onSelect={() => handleSelect(entry.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 11px",
                  borderRadius: "var(--r-sm)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: soon ? "var(--ink-faint)" : "var(--ink-muted)",
                  cursor: soon ? "not-allowed" : "pointer",
                  opacity: soon ? 0.5 : 1,
                }}
                value={`${entry.parentLabel} ${entry.label}`}
              >
                <Icon name={entry.icon} size={15} />
                <span style={{ flex: 1 }}>{entry.label}</span>
                <span
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
                >
                  {soon ? "em construção" : entry.parentLabel}
                </span>
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>,
    document.body
  );
}
