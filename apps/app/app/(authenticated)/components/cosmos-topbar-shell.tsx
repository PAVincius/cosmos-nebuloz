"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { type CosmosPersona, CosmosTopbar } from "./cosmos-topbar";

interface CosmosTopbarShellProps {
  /** current tenant/workspace name, used as the first breadcrumb crumb */
  tenantName: string;
  /** personas available in the switcher pill */
  personas: CosmosPersona[];
  /** persona detected from the member's real role (starting value only) */
  initialPersona: string;
  userName: string;
  userEmail: string;
}

function humanizeSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Derives "workspace > section > page" from the current pathname. */
function buildBreadcrumb(tenantName: string, pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean).map(humanizeSegment);
  return [tenantName, ...segments];
}

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/);
  const initials =
    parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return initials.toUpperCase();
}

function openCommandPalette(): void {
  // CommandPalette (./command-palette.tsx) owns its own open state and only
  // listens for the Cmd/Ctrl+K keydown — dispatch that same event instead of
  // duplicating a second search dialog.
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
  );
}

/**
 * Client wrapper that feeds `CosmosTopbar` with data derived from the route
 * (breadcrumb) and wires its search/persona affordances to the app's real
 * mechanisms (command palette shortcut, detected member role).
 */
export function CosmosTopbarShell({
  tenantName,
  personas,
  initialPersona,
  userName,
  userEmail,
}: CosmosTopbarShellProps) {
  const pathname = usePathname();
  // Persona switching has no backend concept today (role comes from tenant
  // membership) — this is a visual-only local override, not real RBAC.
  const [persona, setPersona] = useState(initialPersona);

  return (
    <CosmosTopbar
      avatarSlot={
        <div
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[11px] font-bold"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            background: "var(--accent-soft)",
            color: "var(--accent-text)",
            border: "1px solid rgba(var(--accent-rgb), .3)",
          }}
          title={`${userName} · ${userEmail}`}
        >
          {getInitials(userName, userEmail)}
        </div>
      }
      breadcrumb={buildBreadcrumb(tenantName, pathname ?? "/")}
      onPersonaChange={setPersona}
      persona={persona}
      personas={personas}
      searchSlot={
        <button
          aria-label="Buscar"
          className="grid h-8 w-8 place-items-center rounded-[8px] border border-[var(--hairline)] bg-[var(--surface-2)] text-[var(--ink-muted)] transition-all duration-150 hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"
          onClick={openCommandPalette}
          type="button"
        >
          <Search size={15} />
        </button>
      }
    />
  );
}
