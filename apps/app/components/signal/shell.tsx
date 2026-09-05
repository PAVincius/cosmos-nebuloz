"use client";

// shell.tsx — casca persistente do Signal: topbar + sidebar + app-switcher.
//
// Mesma anatomia do MeridianShell (o layout do route group não remonta entre
// rotas, então tema e estado de nav sobrevivem à navegação client-side), com
// três diferenças de produto:
//
//  1. O rodapé da sidebar carrega o card de portfólio — múltiplo agregado e
//     dinheiro em risco. É a pergunta do CFO respondida antes de ele clicar em
//     qualquer coisa.
//  2. O topbar carrega o chip de saúde das fontes. Um ROI calculado sobre fonte
//     caída é o pior defeito possível deste produto, e o chip existe para que
//     ninguém leia um número sem saber disso.
//  3. O seletor de PERSONA do handoff NÃO foi portado. No protótipo ele
//     reordenava a leitura (o CFO vê dinheiro primeiro, o CTO vê adoção). Em
//     produção, um dropdown que não muda nada seria pior que a ausência dele, e
//     um que mudasse permissão seria escalada de privilégio — que é a mesma
//     razão pela qual o Meridian também deixou o seu de fora. O que sobrevive
//     da ideia é o efeito: o papel real fica visível no topbar. A lente de
//     leitura volta quando houver comportamento especificado por trás dela.

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Avatar, IconButton, NavCtx } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useCallback, useMemo } from "react";
import { fmtBRL, fmtMultiple } from "@/lib/signal/roi";
import { Eyebrow, ModalProvider } from "./base";
import { SignalPalette } from "./palette";
import { SignalPrefs } from "./prefs";

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
    icon: "signal",
    blurb: "Adoção e valor de iniciativas de IA",
  },
};

export type NavItem = { id: string; icon: IconName; label: string };
type NavSection = { label: string; items: NavItem[] };

/** Ordem e agrupamento do handoff (signal-shell.jsx). Valor primeiro porque é
 *  a pergunta; Prova e Dado são o que sustenta a resposta. */
export const NAV: NavSection[] = [
  {
    label: "Valor",
    items: [
      { id: "overview", icon: "signal", label: "Visão geral" },
      { id: "initiatives", icon: "target", label: "Iniciativas" },
      { id: "alerts", icon: "alert", label: "Alertas" },
    ],
  },
  {
    label: "Prova",
    items: [
      { id: "evidence", icon: "fileText", label: "Evidências" },
      { id: "audit", icon: "history", label: "Trilha de auditoria" },
      { id: "reports", icon: "download", label: "Relatórios" },
    ],
  },
  {
    label: "Dado",
    items: [
      { id: "connections", icon: "plug", label: "Conexões" },
      { id: "mapping", icon: "ruler", label: "Mapeamento de métricas" },
    ],
  },
  {
    label: "Sistema",
    items: [{ id: "settings", icon: "settings", label: "Configurações" }],
  },
];

export const TITLES: Record<string, [string, string]> = {
  overview: ["Visão geral", "Valor"],
  initiatives: ["Iniciativas", "Valor"],
  initiative: ["Iniciativa", "Iniciativas"],
  alerts: ["Alertas", "Valor"],
  evidence: ["Evidências", "Prova"],
  audit: ["Trilha de auditoria", "Prova"],
  reports: ["Relatórios", "Prova"],
  connections: ["Conexões", "Dado"],
  mapping: ["Mapeamento de métricas", "Dado"],
  settings: ["Configurações", "Sistema"],
};

export type ShellBadges = Partial<Record<string, number>>;

export type SignalShellProps = {
  children?: ReactNode;
  screenIds: string[];
  modules: ModuleId[];
  user: { name: string; role: string };
  organization: string;
  badges?: ShellBadges;
  /** Vermelho quando há alerta de uso sem valor; âmbar com qualquer outro. */
  alertsTone?: "red" | "amber" | null;
  brokenConnections?: number;
  portfolio?: {
    invested: number;
    returned: number;
    multiple: number | null;
    atRisk: number;
    fiscalYearLabel: string | null;
  };
  valueBar?: number;
};

export function href(id: string) {
  return id === "overview" ? "/signal" : `/signal/${id}`;
}

const SIGNAL_PREFIX = /^\/signal\/?/;

function activeIdFromPath(pathname: string): string {
  const rest = pathname.replace(SIGNAL_PREFIX, "");
  if (!rest) {
    return "overview";
  }
  return rest.split("/")[0] as string;
}

/** Item de nav aceso para a seção corrente. O detalhe mantém a carteira acesa:
 *  sair de uma iniciativa não deveria parecer sair da seção. */
function navHighlightFor(activeId: string): string {
  return activeId === "initiative" ? "initiatives" : activeId;
}

/** Tom do contador por item. Só onde o número significa problema — um badge
 *  colorido em tudo não destaca nada. */
const BADGE_TONE: Record<string, "red" | "amber" | undefined> = {
  connections: "red",
};

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
          name="signal"
          size={15}
          strokeWidth={2}
          style={{ color: "var(--accent-fg)" }}
        />
      </span>
      <span
        className="display"
        style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".1em" }}
      >
        SIGNAL
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
        V1 · MEDIÇÃO
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
  tone,
  comingSoon,
}: NavItem & {
  active: boolean;
  count?: number;
  tone?: "red" | "amber";
  comingSoon: boolean;
}) {
  const body = (
    <>
      {active ? (
        <span
          aria-hidden="true"
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
      ) : null}
      <Icon name={icon} size={15.5} strokeWidth={active ? 2.1 : 1.9} />
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
      {count !== undefined && count > 0 && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 7px",
            borderRadius: 99,
            background: tone ? `var(--${tone}-soft)` : "var(--chip-bg)",
            color: tone ? `var(--${tone}-text)` : "var(--ink-faint)",
          }}
        >
          {count}
        </span>
      )}
    </>
  );
  const style = {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left" as const,
    background: active ? "var(--accent-soft)" : "none",
    border: `1px solid ${active ? "rgba(var(--accent-rgb),.18)" : "transparent"}`,
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
  // Hoisted em vez de ternário no atributo: `aria-current` só deve existir no
  // item corrente, e `undefined` inline é o que o linter recusa em JSX.
  const ariaCurrent = active ? "page" : undefined;
  return (
    <Link
      aria-current={ariaCurrent}
      className="btn navitem"
      href={href(id)}
      style={style}
    >
      {body}
    </Link>
  );
}

/**
 * Card de portfólio do rodapé da sidebar.
 *
 * Responde a pergunta do CFO antes do primeiro clique: quanto voltou sobre
 * quanto entrou, e quanto disso está em iniciativas sem prova. O valor em risco
 * fica separado por linha tracejada porque não é um detalhe do múltiplo — é a
 * outra metade da decisão.
 */
function PortfolioCard({
  portfolio,
  valueBar,
}: {
  portfolio: NonNullable<SignalShellProps["portfolio"]>;
  valueBar: number;
}) {
  const healthy = portfolio.multiple !== null && portfolio.multiple >= valueBar;
  return (
    <div
      style={{
        padding: "12px 13px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        margin: "0 4px",
      }}
    >
      <Eyebrow>Portfólio {portfolio.fiscalYearLabel ?? ""}</Eyebrow>
      <div
        className="display"
        style={{
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-.02em",
          fontVariantNumeric: "tabular-nums",
          color: healthy ? "var(--green-text)" : "var(--amber-text)",
          marginTop: 5,
          lineHeight: 1,
        }}
      >
        {fmtMultiple(portfolio.multiple)}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-faint)",
          marginTop: 4,
          lineHeight: 1.4,
        }}
      >
        {fmtBRL(portfolio.returned)} sobre {fmtBRL(portfolio.invested)}
      </div>
      {portfolio.atRisk > 0 && (
        <div
          style={{
            marginTop: 9,
            paddingTop: 9,
            borderTop: "1px dashed var(--hairline)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 11.5,
              fontWeight: 700,
              color: "var(--red-text)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                background: "var(--red)",
                flexShrink: 0,
              }}
            />
            {fmtBRL(portfolio.atRisk)} em risco
          </span>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--ink-faint)",
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            Iniciativas sem prova de valor.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Chip de saúde das fontes.
 *
 * Fica no topbar, e não numa tela, de propósito: o número na tela ao lado pode
 * estar congelado há dias, e quem lê precisa saber disso sem ter de procurar.
 */
function SourcesChip({ broken }: { broken: number }) {
  const bad = broken > 0;
  return (
    <Link
      className="btn navitem"
      href={href("connections")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 11px",
        borderRadius: 99,
        border: `1px solid ${bad ? "rgba(var(--red-rgb),.35)" : "var(--hairline-strong)"}`,
        background: bad ? "var(--red-soft)" : "var(--surface)",
      }}
      title="Saúde das fontes de dado"
    >
      <span
        aria-hidden="true"
        className="pulse-dot"
        style={
          {
            width: 7,
            height: 7,
            borderRadius: 99,
            flexShrink: 0,
            background: bad ? "var(--red)" : "var(--green)",
            "--pulse-rgb": bad ? "var(--red-rgb)" : "var(--green-rgb)",
          } as React.CSSProperties
        }
      />
      <span
        className="mono"
        style={{
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: "nowrap",
          color: bad ? "var(--red-text)" : "var(--ink-muted)",
        }}
      >
        {bad
          ? `${broken} fonte${broken > 1 ? "s" : ""} com problema`
          : "Fontes ok"}
      </span>
    </Link>
  );
}

function AppSwitcher({ modules }: { modules: ModuleId[] }) {
  const others = modules.filter((m) => m !== "SIGNAL");
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

export function SignalShell({
  children,
  screenIds,
  modules,
  user,
  organization,
  badges = {},
  alertsTone = null,
  brokenConnections = 0,
  portfolio,
  valueBar = 1.5,
}: SignalShellProps) {
  const pathname = usePathname() || "/signal";
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const activeId = activeIdFromPath(pathname);
  const highlight = navHighlightFor(activeId);

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

  const [title, parent] = TITLES[activeId] ?? ["Signal", "Nebuloz"];

  return (
    <NavCtx.Provider value={{ navigate, isComingSoon }}>
      {/* O host de modal fica na casca, não em cada tela: um provider por tela
          significaria um foco preso por tela, e dois modais abertos ao mesmo
          tempo se o usuário navegasse com um aberto. */}
      <ModalProvider>
        <SignalPrefs />
        <div className="signal-root grain" style={{ display: "flex" }}>
          {/* WCAG 2.4.1 — o primeiro Tab da página pula a navegação inteira. */}
          <a className="skip" href="#signal-main">
            Pular para o conteúdo
          </a>

          <nav
            aria-label="Navegação do Signal"
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
                    active={highlight === it.id}
                    comingSoon={isComingSoon(it.id)}
                    count={badges[it.id]}
                    icon={it.icon}
                    id={it.id}
                    key={it.id}
                    label={it.label}
                    tone={
                      it.id === "alerts"
                        ? (alertsTone ?? undefined)
                        : BADGE_TONE[it.id]
                    }
                  />
                ))}
              </div>
            ))}

            {portfolio ? (
              <div style={{ marginTop: "auto" }}>
                <PortfolioCard portfolio={portfolio} valueBar={valueBar} />
              </div>
            ) : null}
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
              <SourcesChip broken={brokenConnections} />
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
              id="signal-main"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px 28px 48px",
              }}
              tabIndex={-1}
            >
              <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
            </main>
          </div>

          <SignalPalette screenIds={screenIds} />
        </div>
      </ModalProvider>
    </NavCtx.Provider>
  );
}

export function ComingSoon({ id }: { id: string }) {
  const [title] = TITLES[id] ?? [id, "Signal"];
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
      <Icon name="signal" size={28} style={{ color: "var(--ink-faint)" }} />
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
