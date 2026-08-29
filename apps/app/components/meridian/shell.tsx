"use client";

// shell.tsx — casca persistente do Meridian: topbar + sidebar + app-switcher.
//
// Mesma anatomia do CharterShell (o layout do route group não remonta entre
// rotas, então tema e estado de nav sobrevivem à navegação client-side), com
// duas diferenças de produto:
//
//  1. O seletor de persona do protótipo NÃO existe aqui. Em produção o papel
//     vem da sessão; trocar de papel no topbar seria escalada de privilégio.
//     O que sobrevive da ideia é o efeito: o papel fica visível no topbar.
//  2. O rodapé da sidebar carrega as regras do V1 — append-only, auditoria de
//     evidência, assistência obrigatória do consultor. São as três invariantes
//     que explicam por que a tela pede rationale e não deixa apagar nada.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Avatar, IconButton, NavCtx } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useCallback, useMemo } from "react";
import { Eyebrow } from "./base";

export type ModuleId = "COSMOS" | "CHARTER" | "SIGNAL" | "MERIDIAN";

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
  MERIDIAN: {
    label: "Meridian",
    href: "/meridian",
    icon: "compass",
    blurb: "Diagnóstico de prontidão para IA",
  },
  SIGNAL: {
    label: "Signal",
    href: "/signal",
    icon: "trendingUp",
    blurb: "Valor entregue e medição",
  },
};

type NavItem = { id: string; icon: IconName; label: string };
type NavSection = { label: string; items: NavItem[] };

/** Ordem e agrupamento do handoff (meridian-shell.jsx). Diagnose primeiro
 *  porque é o fluxo operacional; Registro e Campo são consulta e visita. */
const NAV: NavSection[] = [
  {
    label: "Diagnose",
    items: [
      { id: "assessments", icon: "compass", label: "Assessments" },
      { id: "queue", icon: "gavel", label: "Fila de revisão" },
      { id: "benchmark", icon: "activity", label: "Benchmark pool" },
    ],
  },
  {
    label: "Registro",
    items: [
      { id: "registry", icon: "crosshair", label: "Gap register" },
      { id: "confidence", icon: "scale", label: "Escala de confiança" },
    ],
  },
  {
    label: "Campo",
    items: [
      { id: "respondent", icon: "userCheck", label: "Visão do respondente" },
    ],
  },
];

export const TITLES: Record<string, [string, string]> = {
  assessments: ["Assessments", "Diagnose"],
  assessment: ["Assessment", "Diagnose"],
  queue: ["Fila de revisão", "Diagnose"],
  benchmark: ["Benchmark pool", "Diagnose"],
  registry: ["Gap register", "Registro"],
  confidence: ["Escala de confiança", "Registro"],
  respondent: ["Visão do respondente", "Campo"],
};

export type ShellBadges = Partial<Record<string, number>>;

export type MeridianShellProps = {
  children?: ReactNode;
  screenIds: string[];
  modules: ModuleId[];
  user: { name: string; role: string };
  organization: string;
  badges?: ShellBadges;
};

function href(id: string) {
  return id === "assessments" ? "/meridian" : `/meridian/${id}`;
}

const MERIDIAN_PREFIX = /^\/meridian\/?/;

function activeIdFromPath(pathname: string): string {
  const rest = pathname.replace(MERIDIAN_PREFIX, "");
  if (!rest) {
    return "assessments";
  }
  const head = rest.split("/")[0] as string;
  // O detalhe mantém a carteira acesa: sair de um assessment não deveria
  // parecer sair da seção.
  return head === "assessment" ? "assessments" : head;
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(145deg,var(--accent),rgba(var(--accent-rgb),.55))",
          boxShadow: "0 0 18px -4px rgba(var(--accent-rgb),.7)",
        }}
      >
        <Icon
          name="compass"
          size={15}
          strokeWidth={2}
          style={{ color: "var(--accent-fg)" }}
        />
      </span>
      <span
        className="display"
        style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".1em" }}
      >
        MERIDIAN
      </span>
      <span
        className="mono"
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: ".12em",
          padding: "3px 8px",
          borderRadius: 99,
          background: "var(--chip-bg)",
          border: "1px solid var(--hairline)",
          color: "var(--ink-subtle)",
        }}
      >
        V1 · DIAGNOSE
      </span>
    </div>
  );
}

function NavRow({
  id,
  icon,
  label,
  active,
  count,
  comingSoon,
}: NavItem & { active: boolean; count?: number; comingSoon: boolean }) {
  const body = (
    <>
      <Icon name={icon} size={15.5} strokeWidth={active ? 2.1 : 1.9} />
      {label}
      {count !== undefined && count > 0 && (
        <span
          className="mono"
          style={{
            marginLeft: "auto",
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 99,
            background: "var(--amber-soft)",
            color: "var(--amber-text)",
          }}
        >
          {count}
        </span>
      )}
    </>
  );
  const style = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left" as const,
    background: active ? "var(--accent-soft)" : "none",
    border: "none",
    borderRadius: 9,
    padding: "8.5px 10px",
    color: active ? "var(--accent-text)" : "var(--ink-muted)",
    fontSize: 13,
    fontWeight: active ? 700 : 600,
  };

  // Tela ainda não portada vira item desabilitado com motivo, não link morto.
  if (comingSoon) {
    return (
      <span
        aria-disabled="true"
        style={{ ...style, opacity: 0.45, cursor: "not-allowed" }}
        title="Em construção"
      >
        {body}
      </span>
    );
  }
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="btn navitem"
      href={href(id)}
      style={style}
    >
      {body}
    </Link>
  );
}

function AppSwitcher({ modules }: { modules: ModuleId[] }) {
  const others = modules.filter((m) => m !== "MERIDIAN");
  // Com um módulo só, o switcher some — um menu com uma opção é ruído.
  if (others.length === 0) {
    return null;
  }
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {others.map((m) => (
        <Link
          className="btn navitem"
          href={MODULE_META[m].href}
          key={m}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 99,
            border: "1px solid var(--hairline)",
            color: "var(--ink-subtle)",
            fontSize: 11.5,
            fontWeight: 700,
          }}
          title={MODULE_META[m].blurb}
        >
          <Icon name={MODULE_META[m].icon} size={13} />
          {MODULE_META[m].label}
        </Link>
      ))}
    </div>
  );
}

export function MeridianShell({
  children,
  screenIds,
  modules,
  user,
  organization,
  badges = {},
}: MeridianShellProps) {
  const pathname = usePathname() || "/meridian";
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

  const [title, parent] = TITLES[activeId] ?? ["Meridian", "Nebuloz"];

  return (
    <NavCtx.Provider value={{ navigate, isComingSoon }}>
      <div className="meridian-root grain" style={{ display: "flex" }}>
        <nav
          className="scroll"
          style={{
            width: 232,
            flexShrink: 0,
            borderRight: "1px solid var(--hairline)",
            background: "var(--sidebar)",
            padding: "16px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflowY: "auto",
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

          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                padding: 12,
                borderRadius: "var(--r-md)",
                border: "1px dashed var(--hairline-strong)",
                margin: "0 4px",
              }}
            >
              <Eyebrow tone="amber">Regras do V1</Eyebrow>
              <p
                style={{
                  margin: "7px 0 0",
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                }}
              >
                Respostas e overrides são append-only. Todo acesso a evidência é
                auditado. Assistência do consultor é obrigatória.
              </p>
            </div>
          </div>
        </nav>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              height: 56,
              flexShrink: 0,
              padding: "0 20px",
              borderBottom: "1px solid var(--hairline)",
              background: "var(--sidebar)",
            }}
          >
            <Brand />
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                fontWeight: 600,
              }}
            >
              {parent} <span style={{ opacity: 0.5 }}>›</span>{" "}
              <span style={{ color: "var(--ink-muted)" }}>{title}</span>
            </span>
            <div style={{ flex: 1 }} />
            <AppSwitcher modules={modules} />
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-subtle)",
                fontWeight: 600,
              }}
              title={organization}
            >
              {user.role} · {user.name}
            </span>
            <IconButton
              name={theme === "dark" ? "sun" : "moon"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Alternar tema"
            />
            <Avatar name={user.name} size={28} />
          </header>

          <main
            className="scroll bg-grid"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px 28px 48px",
            }}
          >
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
          </main>
        </div>
      </div>
    </NavCtx.Provider>
  );
}

export function ComingSoon({ id }: { id: string }) {
  const [title] = TITLES[id] ?? [id, "Meridian"];
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        padding: "80px 24px",
        textAlign: "center",
        gap: 10,
      }}
    >
      <Icon name="compass" size={28} style={{ color: "var(--ink-faint)" }} />
      <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>
        {title}
      </div>
      <p
        style={{
          margin: 0,
          maxWidth: "48ch",
          fontSize: 13,
          color: "var(--ink-muted)",
          lineHeight: 1.6,
        }}
      >
        Tela ainda não portada do handoff. A nav mostra o item desabilitado em
        vez de um link morto.
      </p>
    </div>
  );
}
