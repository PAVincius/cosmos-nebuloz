"use client";

// shell.tsx — casca persistente do Charter: Sidebar + Topbar + app-switcher.
//
// Mesma anatomia do CosmosShell (o layout do route group não remonta entre
// rotas, então tema e estado de nav sobrevivem à navegação client-side), com
// três diferenças de produto:
//
//  1. O seletor de persona do protótipo NÃO existe aqui. Em produção o papel
//     vem da sessão; trocar de papel no topbar seria escalada de privilégio.
//     O que sobrevive da ideia é o efeito: o papel fica visível, e ação sem
//     grant aparece desabilitada com motivo (ver GatedButton em base.tsx).
//  2. App-switcher entre módulos contratados — o tenant pode ter Cosmos,
//     Charter, Signal ou um subconjunto. Com um módulo só, o switcher some.
//  3. Estado da política vive na sidebar: é o que o Compliance Lead olha
//     primeiro de manhã.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Avatar, IconButton, NavCtx } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Eyebrow, StatusDot } from "./base";
import { FS } from "./type-scale";

export type ModuleId = "COSMOS" | "CHARTER" | "SIGNAL";

const MODULE_META: Record<
  ModuleId,
  { label: string; href: string; icon: IconName; blurb: string }
> = {
  COSMOS: {
    label: "Cosmos",
    href: "/cosmos",
    icon: "grid",
    blurb: "Execução e coordenação SAFe",
  },
  CHARTER: {
    label: "Charter",
    href: "/charter",
    icon: "shield",
    blurb: "Governança e política de IA",
  },
  SIGNAL: {
    label: "Signal",
    href: "/signal",
    icon: "trendingUp",
    blurb: "Valor realizado de IA",
  },
};

type NavItem = { id: string; icon: IconName; label: string };
type NavSection = { label: string; items: NavItem[] };

/** Ordem e agrupamento do handoff (charter-shell.jsx), cobrindo a IA do
 *  PRD §7.1. Contagens vêm do servidor — nunca hard-coded. */
const NAV: NavSection[] = [
  {
    label: "Governança",
    items: [
      { id: "dashboard", icon: "gauge", label: "Visão Geral" },
      { id: "policy", icon: "fileText", label: "Políticas" },
      { id: "cases", icon: "inbox", label: "Casos de Uso" },
    ],
  },
  {
    label: "Risco",
    items: [
      { id: "risk", icon: "target", label: "Matriz de Risco" },
      { id: "vendors", icon: "plug", label: "Fornecedores" },
    ],
  },
  {
    label: "Pessoas",
    items: [{ id: "onboarding", icon: "userCheck", label: "Onboarding" }],
  },
  {
    label: "Evidência",
    items: [
      { id: "audit", icon: "history", label: "Histórico de Auditoria" },
      { id: "conformidade", icon: "scale", label: "Mapa de Conformidade" },
    ],
  },
];

export const TITLES: Record<string, [string, string]> = {
  dashboard: ["Visão Geral", "Governança"],
  policy: ["Políticas", "Governança"],
  cases: ["Casos de Uso", "Governança"],
  case: ["Caso de Uso", "Casos de Uso"],
  risk: ["Matriz de Risco", "Risco"],
  vendors: ["Fornecedores", "Risco"],
  vendor: ["Fornecedor", "Fornecedores"],
  onboarding: ["Onboarding", "Pessoas"],
  audit: ["Auditoria", "Evidência"],
  conformidade: ["Mapa de Conformidade", "Evidência"],
  settings: ["Configurações", "Charter"],
};

export type ShellBadges = Partial<Record<string, number>>;

export type CharterShellProps = {
  children?: ReactNode;
  screenIds: string[];
  modules: ModuleId[];
  user: { name: string; role: string };
  organization: string;
  policy: { version: string | null; daysToReview: number | null } | null;
  /** Contagens por item de nav, calculadas no servidor. */
  badges?: ShellBadges;
};

function href(id: string) {
  return id === "dashboard" ? "/charter" : `/charter/${id}`;
}

const CHARTER_PREFIX = /^\/charter\/?/;

function activeIdFromPath(pathname: string): string {
  const rest = pathname.replace(CHARTER_PREFIX, "");
  if (!rest) {
    return "dashboard";
  }
  return rest.split("/")[0];
}

function Brand() {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
    >
      <span
        style={{
          position: "relative",
          width: 30,
          height: 30,
          borderRadius: 9,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(150deg, rgba(var(--accent-rgb),.9), rgba(var(--accent-rgb),.55))",
          boxShadow:
            "0 0 14px rgba(var(--accent-rgb),.4), inset 0 1px 0 rgba(255,255,255,.3)",
        }}
      >
        <Icon
          name="shield"
          size={16}
          strokeWidth={2.1}
          style={{ color: "var(--accent-fg)" }}
        />
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          className="display"
          style={{
            display: "block",
            fontSize: FS.forte,
            fontWeight: 700,
            letterSpacing: "-.02em",
            color: "var(--ink)",
            lineHeight: 1.1,
          }}
        >
          Charter
        </span>
        <span
          className="mono"
          style={{
            display: "block",
            fontSize: FS.micro,
            fontWeight: 700,
            letterSpacing: ".18em",
            color: "var(--ink-faint)",
            marginTop: 1,
          }}
        >
          NEBULOZ
        </span>
      </span>
    </div>
  );
}

function NavRow({
  icon,
  label,
  active,
  count,
  id,
  comingSoon,
}: {
  icon: IconName;
  label: string;
  active: boolean;
  count?: number;
  id: string;
  comingSoon: boolean;
}) {
  const content = (
    <>
      {active && (
        <span
          style={{
            position: "absolute",
            left: -10,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 99,
            background: "var(--accent)",
            boxShadow: "0 0 10px 1px rgba(var(--accent-rgb),.7)",
          }}
        />
      )}
      <Icon name={icon} size={15} strokeWidth={2} />
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {typeof count === "number" && count > 0 && (
        <span
          className="mono"
          style={{
            fontSize: FS.micro,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 99,
            background: active
              ? "rgba(var(--accent-rgb),.25)"
              : "var(--amber-soft)",
            color: active ? "var(--accent-text)" : "var(--amber-text)",
          }}
        >
          {count}
        </span>
      )}
    </>
  );

  const style: CSSProperties = {
    position: "relative",
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: 10,
    padding: "7px 10px",
    borderRadius: "var(--r-sm)",
    textAlign: "left",
    fontSize: FS.base,
    border: `1px solid ${active ? "rgba(var(--accent-rgb),.18)" : "transparent"}`,
    background: active ? "var(--accent-soft)" : "transparent",
    color: active ? "var(--accent-text)" : "var(--ink-muted)",
    fontWeight: active ? 700 : 500,
  };

  if (comingSoon) {
    return (
      <span
        style={{ ...style, opacity: 0.45, cursor: "not-allowed" }}
        title="Em breve"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="navitem btn"
      href={href(id)}
      style={style}
    >
      {content}
    </Link>
  );
}

function Sidebar({
  activeId,
  user,
  policy,
  badges,
  isComingSoon,
}: {
  activeId: string;
  user: { name: string; role: string };
  policy: CharterShellProps["policy"];
  badges: ShellBadges;
  isComingSoon: (id: string) => boolean;
}) {
  return (
    <aside
      aria-label="Navegação do Charter"
      className="scroll"
      style={{
        width: 232,
        flexShrink: 0,
        overflowY: "auto",
        borderRight: "1px solid var(--hairline)",
        background: "var(--sidebar)",
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {NAV.map((sec) => (
        <div
          key={sec.label}
          style={{ display: "flex", flexDirection: "column", gap: 3 }}
        >
          <Eyebrow style={{ padding: "0 10px 5px" }}>{sec.label}</Eyebrow>
          {sec.items.map((it) => (
            <NavRow
              active={activeId === it.id}
              comingSoon={isComingSoon(it.id)}
              count={badges[it.id]}
              icon={it.icon}
              id={it.id}
              key={it.id}
              label={it.label}
            />
          ))}
        </div>
      ))}

      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {policy && (
          <div
            style={{
              padding: "12px 13px",
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
            }}
          >
            <div style={{ marginBottom: 7 }}>
              <StatusDot
                label={
                  policy.version ? "Política publicada" : "Sem versão publicada"
                }
                tone={policy.version ? "green" : "amber"}
              />
            </div>
            <div
              className="mono"
              style={{
                fontSize: FS.forte,
                fontWeight: 800,
                color: "var(--ink)",
                letterSpacing: "-.01em",
              }}
            >
              {policy.version ?? "—"}
            </div>
            {policy.daysToReview !== null && (
              <div
                style={{
                  fontSize: FS.nota,
                  color:
                    policy.daysToReview < 0
                      ? "var(--red-text)"
                      : "var(--ink-faint)",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                {policy.daysToReview < 0
                  ? `Revisão vencida há ${Math.abs(policy.daysToReview)} dias`
                  : `Revisão obrigatória em ${policy.daysToReview} dias`}
              </div>
            )}
          </div>
        )}

        <NavRow
          active={activeId === "settings"}
          comingSoon={isComingSoon("settings")}
          icon="settings"
          id="settings"
          label="Configurações"
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "8px 10px",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <Avatar name={user.name} size={26} tone="accent" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: FS.nota,
                fontWeight: 700,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.name}
            </div>
            {/* Papel de governança sempre visível: é o que explica por que um
                botão está desabilitado. */}
            <div style={{ fontSize: FS.micro, color: "var(--ink-faint)" }}>
              {user.role}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ModuleSwitcher({ modules }: { modules: ModuleId[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  // Um módulo só: não há para onde trocar, o controle vira ruído.
  if (modules.length < 2) {
    return null;
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        aria-expanded={open}
        aria-label="Trocar de módulo"
        className="btn navitem"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 9px 5px 7px",
          borderRadius: 99,
          border: "1px solid var(--hairline-strong)",
          background: "var(--surface)",
          cursor: "pointer",
        }}
        type="button"
      >
        <Icon name="shield" size={13} strokeWidth={2.2} />
        <span
          style={{ fontSize: FS.nota, fontWeight: 700, color: "var(--ink)" }}
        >
          Charter
        </span>
        <Icon
          name="chevronDown"
          size={13}
          style={{ color: "var(--ink-faint)" }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 7px)",
            right: 0,
            zIndex: 60,
            width: 268,
            padding: 7,
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            border: "1px solid var(--hairline-strong)",
            boxShadow: "0 22px 44px -18px rgba(0,0,0,.55)",
          }}
        >
          <Eyebrow style={{ padding: "6px 9px 8px" }}>
            Módulos contratados
          </Eyebrow>
          {modules.map((m) => {
            const meta = MODULE_META[m];
            const on = m === "CHARTER";
            return (
              <Link
                aria-current={on ? "page" : undefined}
                className="btn navitem"
                href={meta.href}
                key={m}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  width: "100%",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 9px",
                  borderRadius: "var(--r-sm)",
                  background: on ? "var(--accent-soft)" : "transparent",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 99,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: "var(--chip-bg)",
                    color: "var(--ink-muted)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <Icon name={meta.icon} size={13} strokeWidth={2.1} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: FS.base,
                      fontWeight: 700,
                      color: on ? "var(--accent-text)" : "var(--ink)",
                    }}
                  >
                    {meta.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: FS.nota,
                      color: "var(--ink-faint)",
                    }}
                  >
                    {meta.blurb}
                  </span>
                </span>
                {on && (
                  <Icon
                    name="check"
                    size={14}
                    style={{ marginLeft: "auto", color: "var(--accent-text)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Topbar({
  activeId,
  theme,
  onToggleTheme,
  modules,
  organization,
}: {
  activeId: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  modules: ModuleId[];
  organization: string;
}) {
  const [title, parent] = TITLES[activeId] ?? ["Charter", "Nebuloz"];
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        height: 56,
        padding: "0 18px",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--sidebar)",
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      <Brand />
      <span style={{ width: 1, height: 22, background: "var(--hairline)" }} />
      <nav
        aria-label="Breadcrumb"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          minWidth: 0,
          flexShrink: 1,
        }}
      >
        <Link
          className="btn navitem"
          href="/charter"
          style={{
            padding: "2px 4px",
            borderRadius: 5,
            fontSize: FS.nota,
            color: "var(--ink-faint)",
            whiteSpace: "nowrap",
          }}
        >
          {organization}
        </Link>
        <Icon
          name="chevronRight"
          size={12}
          style={{ color: "var(--ink-faint)" }}
        />
        <span style={{ fontSize: FS.nota, color: "var(--ink-subtle)" }}>
          {parent}
        </span>
        <Icon
          name="chevronRight"
          size={12}
          style={{ color: "var(--ink-faint)" }}
        />
        <span
          style={{
            fontSize: FS.base,
            fontWeight: 700,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </nav>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <ModuleSwitcher modules={modules} />
        <IconButton
          name={theme === "dark" ? "sun" : "moon"}
          onClick={onToggleTheme}
          size={32}
          title="Alternar tema"
        />
      </div>
    </header>
  );
}

export function CharterShell({
  children,
  screenIds,
  modules,
  user,
  organization,
  policy,
  badges = {},
}: CharterShellProps) {
  const pathname = usePathname() || "/charter";
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const activeId = activeIdFromPath(pathname);

  const screenIdSet = useMemo(() => new Set(screenIds), [screenIds]);
  const isComingSoon = useCallback(
    (id: string) => !screenIdSet.has(id),
    [screenIdSet]
  );
  const navigate = useCallback(
    (id: string, param?: string) =>
      router.push(param ? `${href(id)}/${param}` : href(id)),
    [router]
  );

  return (
    <NavCtx.Provider value={{ navigate, isComingSoon }}>
      <div className="charter-root grain" style={{ display: "flex" }}>
        <Sidebar
          activeId={activeId}
          badges={badges}
          isComingSoon={isComingSoon}
          policy={policy}
          user={user}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <Topbar
            activeId={activeId}
            modules={modules}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            organization={organization}
            theme={theme}
          />
          {/* Região rolável precisa de tab stop, senão quem usa só teclado não
              consegue rolar o conteúdo. Rotulada para o stop anunciar o que é. */}
          <section
            aria-label="Conteúdo da tela"
            className="scroll bg-grid"
            style={{ flex: 1, overflowY: "auto", padding: "24px 28px 40px" }}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: axe scrollable-region-focusable exige container focável
            tabIndex={0}
          >
            {children}
          </section>
        </div>
      </div>
    </NavCtx.Provider>
  );
}

export function ComingSoon({ id }: { id: string }) {
  const [title] = TITLES[id] ?? [id, "Charter"];
  return (
    <div style={{ padding: "60px 0", textAlign: "center" }}>
      <Eyebrow style={{ marginBottom: 8 }}>Em breve</Eyebrow>
      <div
        className="display"
        style={{ fontSize: FS.display, fontWeight: 700, color: "var(--ink)" }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: FS.base,
          color: "var(--ink-muted)",
          marginTop: 6,
        }}
      >
        Esta tela ainda não foi implementada.
      </div>
    </div>
  );
}
