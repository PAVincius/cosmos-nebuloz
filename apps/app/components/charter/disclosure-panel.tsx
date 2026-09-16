"use client";

// disclosure-panel.tsx — painel explicativo que começa fechado nas telas de
// operação (crítica de design, onda 5a: painéis estáticos ocupavam 35-45% de
// várias telas em toda visita, com copy de onboarding morando permanente em
// tela de trabalho). O texto do painel não muda — só deixa de abrir sozinho.
//
// Estado por painel, não por sessão: `charter.panel.<id>` sobrevive a
// navegação e reload, então quem abre um painel uma vez não precisa reabrir a
// cada visita. Segue o mesmo idioma de `components/signal/prefs.tsx` — leitura
// e escrita embrulhadas em try/catch, porque localStorage indisponível (modo
// privado, quota) não pode derrubar a tela.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";
import { useState } from "react";

const STORAGE_PREFIX = "charter.panel.";

function readStored(id: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw === "1") {
      return true;
    }
    if (raw === "0") {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStored(id: string, open: boolean): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, open ? "1" : "0");
  } catch {
    // Estado que não persiste ainda vale para a sessão corrente.
  }
}

export function DisclosurePanel({
  id,
  title,
  subtitle,
  icon,
  tone,
  children,
  defaultOpen = false,
}: {
  /** Chave estável — vira o sufixo de `charter.panel.<id>` no localStorage. */
  id: string;
  title: string;
  subtitle?: ReactNode;
  icon?: IconName;
  tone?: Tone;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(() => readStored(id) ?? defaultOpen);
  const contentId = `disclosure-panel-${id}`;

  return (
    <SectionCard
      icon={icon}
      subtitle={subtitle}
      title={
        <button
          aria-controls={contentId}
          aria-expanded={open}
          onClick={() =>
            setOpen((prev) => {
              const next = !prev;
              writeStored(id, next);
              return next;
            })
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            font: "inherit",
            color: "inherit",
            letterSpacing: "inherit",
            cursor: "pointer",
          }}
          type="button"
        >
          {title}
          <Icon
            name={open ? "chevronDown" : "chevronRight"}
            size={15}
            style={{ color: "var(--ink-faint)" }}
          />
        </button>
      }
      tone={tone}
    >
      <div hidden={!open} id={contentId}>
        {children}
      </div>
    </SectionCard>
  );
}
