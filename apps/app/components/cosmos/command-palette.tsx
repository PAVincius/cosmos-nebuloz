"use client";

// command-palette.tsx — ⌘K / Ctrl+K command palette for screen navigation (RF-90).
// Self-contained: owns its own open/close state and global keydown listener, so
// mounting <CommandPalette /> once inside CosmosShell is all that's needed.
// RF-91 (F/G+letter single-key shortcuts) is explicitly out of scope here.
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import { useNav } from "./kit";
import { NAV } from "./shell";

type PaletteEntry = {
  id: string;
  label: string;
  parentLabel?: string;
  icon?: IconName;
};

function flattenNav(): PaletteEntry[] {
  const entries: PaletteEntry[] = [];
  for (const item of NAV) {
    if (item.children) {
      for (const child of item.children) {
        entries.push({
          id: child.id,
          label: child.label,
          parentLabel: item.label,
        });
      }
      continue;
    }
    if (item.id) {
      entries.push({ id: item.id, label: item.label, icon: item.icon });
    }
  }
  return entries;
}

const ENTRIES = flattenNav();

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { navigate, isComingSoon } = useNav();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
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
    setOpen(false);
  };

  return createPortal(
    <div
      className="cosmos-root"
      onClick={() => setOpen(false)}
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
      <Command
        label="Navegação por comando"
        onClick={(e) => e.stopPropagation()}
        style={{
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
        <Command.List style={{ maxHeight: 360, overflowY: "auto", padding: 8 }}>
          <Command.Empty
            style={{
              padding: "20px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--ink-subtle)",
            }}
          >
            Nenhum resultado
          </Command.Empty>
          {ENTRIES.map((entry) => {
            const comingSoon = isComingSoon(entry.id);
            return (
              <Command.Item
                disabled={comingSoon}
                key={entry.id}
                onSelect={() => handleSelect(entry.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  fontSize: 13.5,
                  color: comingSoon ? "var(--ink-faint)" : "var(--ink-muted)",
                  cursor: comingSoon ? "default" : "pointer",
                  opacity: comingSoon ? 0.6 : 1,
                }}
                value={entry.label}
              >
                {entry.icon && <Icon name={entry.icon} size={16} />}
                <span style={{ flex: 1 }}>{entry.label}</span>
                {comingSoon ? (
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: "var(--ink-faint)" }}
                  >
                    Em breve
                  </span>
                ) : (
                  entry.parentLabel && (
                    <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                      {entry.parentLabel}
                    </span>
                  )
                )}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>,
    document.body
  );
}
