"use client";

import { AccountSwitcher } from "@repo/design-system/components/account-switcher";
import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Button,
  IconButton,
  NavCtx,
  useNav,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// shell.tsx — persistent app shell (Sidebar + Topbar) driven by real routing.
// Screens live at /cosmos/<id>; the sidebar uses <Link> and derives active from
// the pathname. Theme is held here and survives client-side navigation because
// the (cosmos) layout is not remounted between routes.
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { resolveActiveAccountDestination } from "@/app/actions/auth/resolve-active-account-destination";
import { CommandPalette } from "./command-palette";
import { NAV, type NavItem } from "./nav";

export const TITLES: Record<string, [string, string]> = {
  executive: ["Board Snapshot", "COSMOS"],
  dashboard: ["Visão Geral", "Portfolio"],
  kanban: ["Kanban de Épicos", "Portfolio"],
  wsjf: ["WSJF Rankings", "Portfolio"],
  themes: ["Temas Estratégicos", "Portfolio"],
  value: ["Value Realization", "Portfolio"],
  okrs: ["OKRs", "Portfolio"],
  budgets: ["Lean Budgets", "Portfolio"],
  roadmap: ["Roadmap", "Portfolio"],
  anomalies: ["Anomalias", "Portfolio"],
  arts: ["ARTs", "ART Board"],
  board: ["Board do Time", "Time"],
  program: ["Program Board", "ART Board"],
  piplanning: ["PI Planning", "ART Board"],
  dependencies: ["Dependências", "ART Board"],
  risks: ["Riscos", "ART Board"],
  capacity: ["Capacity Planning", "ART Board"],
  teams: ["Times", "COSMOS"],
  flow: ["Flow Metrics", "Analytics"],
  velocity: ["Velocity", "Analytics"],
  measure: ["Measure & Grow", "Analytics"],
  strategy: ["Strategy Map", "Portfolio"],
  tags: ["Tag Rules", "Portfolio"],
  governance: ["Governance Board", "Portfolio"],
  decisions: ["Decision Log", "Portfolio"],
  solution: ["Large Solution", "COSMOS"],
  workflows: ["Workflows", "COSMOS"],
  integrations: ["Integrações", "COSMOS"],
  webhooks: ["Webhooks", "COSMOS"],
  settings: ["Settings", "COSMOS"],
  copilot: ["Copilot", "COSMOS"],
};

const href = (id: string) => `/cosmos/${id}`;

function ComingSoonPill() {
  return (
    <span
      className="mono"
      style={{
        flexShrink: 0,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: ".04em",
        textTransform: "uppercase",
        padding: "1px 6px",
        borderRadius: 99,
        background: "var(--surface-3)",
        border: "1px solid var(--hairline)",
        color: "var(--ink-faint)",
      }}
    >
      Em breve
    </span>
  );
}

function NavRow({
  icon,
  label,
  active,
  depth = 0,
  to,
  trailing,
  onClick,
  comingSoon,
}: {
  icon?: IconName;
  label: string;
  active?: boolean;
  depth?: number;
  to?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  comingSoon?: boolean;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left",
    padding: depth ? "7px 10px 7px 34px" : "8px 10px",
    borderRadius: "var(--r-md)",
    border: "1px solid transparent",
    background: active ? "var(--accent-soft)" : "transparent",
    color: active ? "var(--accent)" : "var(--ink-muted)",
    fontFamily: "inherit",
    fontSize: 13.5,
    fontWeight: active ? 600 : 500,
    letterSpacing: ".005em",
    position: "relative",
    textDecoration: "none",
    opacity: comingSoon ? 0.55 : 1,
    cursor: comingSoon ? "default" : undefined,
  };
  const inner = (
    <>
      {active && !depth && (
        <span
          style={{
            position: "absolute",
            left: -10,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 99,
            background: "var(--accent)",
          }}
        />
      )}
      {active && depth ? (
        <span
          style={{
            position: "absolute",
            left: 18,
            top: 9,
            bottom: 9,
            width: 2,
            borderRadius: 99,
            background: "var(--accent)",
          }}
        />
      ) : null}
      {icon && <Icon name={icon} size={17} strokeWidth={2} />}
      <span
        style={{
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      {comingSoon ? <ComingSoonPill /> : trailing}
    </>
  );
  // Coming-soon entries render as inert, non-navigable rows — no <Link>/
  // <button> — so they stay visible (roadmap legibility) without being a
  // dead-end click.
  if (comingSoon) {
    return (
      <div aria-disabled="true" className="navitem" style={style}>
        {inner}
      </div>
    );
  }
  if (to) {
    return (
      <Link className="navitem btn" href={to} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button className="navitem btn" onClick={onClick} style={style}>
      {inner}
    </button>
  );
}

// Identity shown in the sidebar (tenant switcher + user footer). Resolved
// server-side in the (cosmos) layout and passed down — shell.tsx is a client
// component and has no access to the session.
export type ShellIdentity = {
  userName: string;
  userEmail: string;
  tenantName: string;
  tenantInitials: string;
  planLabel: string;
  role: string;
  /** Conta ativa + contas da pessoa — AccountSwitcher (spec 009, US2). */
  activeTenantId: string;
  tenants: Array<{ id: string; name: string; role: string }>;
};

function Sidebar({
  activeId,
  identity,
  open,
  onClose,
}: {
  activeId: string;
  identity: ShellIdentity;
  // Abaixo de 1024px a aside vira gaveta; no desktop `open` é ignorado
  // porque a media query não aplica nenhuma das regras de posicionamento.
  open: boolean;
  onClose: () => void;
}) {
  const { isComingSoon } = useNav();
  const childActive = (item: NavItem) =>
    !!item.children?.some((c) => c.id === activeId);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({
    portfolio: true,
  });
  const toggle = (k: string) => setOpenKeys((s) => ({ ...s, [k]: !s[k] }));

  return (
    <aside
      className="cosmos-sidebar"
      data-open={open ? "true" : "false"}
      id="cosmos-drawer"
      style={{
        width: 256,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--sidebar)",
        borderRight: "1px solid var(--hairline)",
      }}
      tabIndex={-1}
    >
      <div style={{ padding: "12px 12px 10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: 8,
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        >
          <span
            className="display"
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--r-sm)",
              display: "grid",
              placeItems: "center",
              background: "var(--accent)",
              color: "var(--on-accent)",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: ".02em",
              boxShadow: "0 4px 12px -4px rgba(var(--accent-rgb),.7)",
            }}
          >
            {identity.tenantInitials}
          </span>
          <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <AccountSwitcher
              data={{
                activeTenantId: identity.activeTenantId,
                tenants: identity.tenants,
              }}
              resolveDestination={resolveActiveAccountDestination}
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: "-.01em",
              }}
            />
            <span
              style={{
                display: "block",
                fontSize: 11.5,
                color: "var(--ink-subtle)",
                fontWeight: 500,
              }}
            >
              Plano {identity.planLabel} · {identity.role}
            </span>
          </span>
        </div>
      </div>

      <div style={{ padding: "0 12px 6px" }}>
        <div
          className="chart-hit"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            color: "var(--ink-subtle)",
            cursor: "pointer",
          }}
        >
          <Icon
            name="search"
            size={15}
            style={{ color: "var(--ink-subtle)" }}
          />
          <span style={{ flex: 1, fontSize: 13 }}>Buscar…</span>
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
            ⌘K
          </span>
        </div>
      </div>

      {/* Clique em qualquer link do nav fecha a gaveta. Um handler no
          contêiner cobre os ~30 <Link> por bubbling; no desktop a gaveta já
          está aberta e onClose não muda nada visível. */}
      <nav
        className="scroll"
        onClick={onClose}
        style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".10em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
            padding: "8px 10px 6px",
          }}
        >
          SAFe Workspace
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => {
            if (item.children) {
              const key = item.key || item.id!;
              const open = openKeys[key] ?? childActive(item);
              return (
                <div key={key}>
                  <NavRow
                    active={childActive(item) && !open}
                    icon={item.icon}
                    label={item.label}
                    onClick={() => toggle(key)}
                    trailing={
                      <Icon
                        name={open ? "chevronDown" : "chevronRight"}
                        size={15}
                        style={{ color: "var(--ink-faint)" }}
                      />
                    }
                  />
                  {open && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        marginTop: 2,
                      }}
                    >
                      {item.children.map((c) => (
                        <NavRow
                          active={activeId === c.id}
                          comingSoon={isComingSoon(c.id)}
                          depth={1}
                          key={c.id}
                          label={c.label}
                          to={href(c.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavRow
                active={activeId === item.id}
                comingSoon={isComingSoon(item.id!)}
                icon={item.icon}
                key={item.id}
                label={item.label}
                to={href(item.id!)}
              />
            );
          })}
        </div>

        <div
          style={{
            height: 1,
            background: "var(--hairline)",
            margin: "12px 6px",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <NavRow
            active={activeId === "webhooks"}
            icon="webhook"
            label="Webhooks"
            to={href("webhooks")}
          />
          <NavRow
            active={activeId === "copilot"}
            comingSoon={isComingSoon("copilot")}
            icon="bot"
            label="Copilot"
            to={href("copilot")}
            trailing={
              <span
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-faint)" }}
              >
                ⌘K
              </span>
            }
          />
        </div>
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--hairline)",
          padding: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Avatar name={identity.userName} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {identity.userName}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-subtle)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {identity.userEmail}
          </div>
        </div>
        <IconButton name="more" size={30} title="Mais opções da conta" />
      </div>
    </aside>
  );
}

function Topbar({
  activeId,
  theme,
  onToggleTheme,
  onOpenNav,
  navButtonRef,
}: {
  activeId: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenNav: () => void;
  navButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const [title, parent] = TITLES[activeId] || [activeId, "COSMOS"];
  return (
    <header
      className="cosmos-topbar"
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        borderBottom: "1px solid var(--hairline)",
        background: "var(--canvas)",
        position: "sticky",
        top: 0,
        zIndex: 20,
        backdropFilter: "saturate(1.2)",
      }}
    >
      <button
        aria-label="Abrir navegação"
        className="cosmos-menu-btn btn navitem"
        onClick={onOpenNav}
        ref={navButtonRef}
        style={{
          alignItems: "center",
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-sm)",
          color: "var(--ink-muted)",
          flexShrink: 0,
          height: 40,
          justifyContent: "center",
          padding: 0,
          width: 40,
        }}
        type="button"
      >
        <Icon name="panelLeft" size={18} />
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13.5,
          minWidth: 0,
        }}
      >
        <span style={{ color: "var(--ink-subtle)", fontWeight: 500 }}>
          {parent}
        </span>
        <Icon
          name="chevronRight"
          size={14}
          style={{ color: "var(--ink-faint)" }}
        />
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{title}</span>
      </div>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          className="btn navitem"
          onClick={onToggleTheme}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px 6px 12px",
            borderRadius: "var(--r-pill)",
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
            color: "var(--ink-muted)",
            fontFamily: "inherit",
            fontSize: 12.5,
            fontWeight: 600,
          }}
          title="Alternar tema"
        >
          {theme === "dark" ? "Escuro" : "Claro"}
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 24,
              height: 24,
              borderRadius: 99,
              background:
                theme === "dark" ? "var(--accent-soft)" : "var(--amber-soft)",
              color: theme === "dark" ? "var(--accent)" : "var(--amber-text)",
            }}
          >
            <Icon
              name={theme === "dark" ? "moon" : "sun"}
              size={14}
              strokeWidth={2}
            />
          </span>
        </button>
        <IconButton name="bell" size={34} title="Notificações" />
        <div style={{ width: 1, height: 20, background: "var(--hairline)" }} />
        <Button icon="sparkles" size="sm" variant="soft">
          Copilot
        </Button>
      </div>
    </header>
  );
}

export function ComingSoon({ id }: { id: string }) {
  const label = (() => {
    for (const n of NAV) {
      if (n.id === id) {
        return n.label;
      }
      const c = n.children?.find((x) => x.id === id);
      if (c) {
        return c.label;
      }
    }
    return TITLES[id]?.[0] || id;
  })();
  return (
    <div
      className="fade-in"
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "60vh",
        textAlign: "center",
      }}
    >
      <div>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 18px",
            borderRadius: "var(--r-xl)",
            display: "grid",
            placeItems: "center",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid rgba(var(--accent-rgb),.25)",
          }}
        >
          <Icon name="layers" size={28} strokeWidth={1.6} />
        </div>
        <h2
          className="display"
          style={{
            margin: "0 0 8px",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-.02em",
          }}
        >
          {label}
        </h2>
        <p
          style={{
            margin: "0 auto",
            maxWidth: 420,
            color: "var(--ink-subtle)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Tela ainda não portada. A fundação (tokens, kit, shell) e o roteamento
          já estão no ar — esta tela entra nas próximas etapas.
        </p>
      </div>
    </div>
  );
}

function activeIdFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean); // ['cosmos', '<id>', ...]
  return parts[1] || "dashboard";
}

export function CosmosShell({
  children,
  screenIds,
  identity,
}: {
  children?: ReactNode;
  // Real session identity, resolved in the (cosmos) server layout.
  identity: ShellIdentity;
  // Keys of SCREENS (screens/registry.tsx), passed down from the (server)
  // layout — a screen id not in this list has no ported component yet, so
  // nav renders it "coming soon" instead of a dead-end link. Computed from
  // the registry itself, not duplicated here, so it can't drift.
  screenIds: string[];
}) {
  const pathname = usePathname() || "/cosmos";
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const activeId = activeIdFromPath(pathname);

  const screenIdSet = useMemo(() => new Set(screenIds), [screenIds]);
  const isComingSoon = useCallback(
    (id: string) => !screenIdSet.has(id),
    [screenIdSet]
  );
  const [navOpen, setNavOpen] = useState(false);
  const navButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(false);

  const closeNav = useCallback(() => {
    setNavOpen((wasOpen) => {
      // Devolve o foco ao gatilho: sem isso, fechar por Escape ou pelo scrim
      // deixa o teclado no início do documento. Só marca a intenção aqui — o
      // botão vive dentro do `inert={navOpen}` abaixo, que só cai no commit, e
      // `focus()` em subárvore inerte é ignorado em silêncio. Quem foca de
      // fato é o efeito abaixo, já com o `inert` removido.
      if (wasOpen) {
        restoreFocusRef.current = true;
      }
      return false;
    });
  }, []);

  const navigate = useCallback(
    (id: string, param?: string) => {
      setNavOpen(false);
      router.push(param ? `${href(id)}/${param}` : href(id));
    },
    [router]
  );

  useEffect(() => {
    if (!navOpen) {
      // Efeito passivo roda depois do commit, então o `inert` do wrapper já
      // saiu do DOM e o botão volta a aceitar foco.
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        navButtonRef.current?.focus();
      }
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeNav();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    // `focus()` em elemento com `visibility: hidden` é ignorado em silêncio, e
    // fechada a gaveta é exatamente isso — o `[data-open="true"]` do
    // cosmos.css só vira `visible` alguns quadros depois. Medido aqui: no
    // primeiro e no segundo quadro após a abertura a visibilidade computada
    // ainda é `hidden`, só no terceiro ela vira `visible`. Por isso esperamos
    // a visibilidade em vez de contar quadros fixos — o back-office recalcula
    // em dois e este shell em três. Um `transitionend` seria exato, mas não
    // dispara com `prefers-reduced-motion`, onde o cosmos.css zera a
    // transição. O teto de quadros evita laço eterno se a regra mudar.
    let frame = 0;
    let attemptsLeft = 20;
    const focusDrawer = () => {
      const drawer = document.getElementById("cosmos-drawer");
      if (drawer && getComputedStyle(drawer).visibility === "visible") {
        drawer.focus();
        return;
      }
      if (attemptsLeft > 0) {
        attemptsLeft -= 1;
        frame = requestAnimationFrame(focusDrawer);
      }
    };
    frame = requestAnimationFrame(focusDrawer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen, closeNav]);

  return (
    <NavCtx.Provider value={{ navigate, isComingSoon }}>
      {/* theme comes from next-themes (data-theme on <html>); toggling is CSS-only, no tree re-render */}
      <div className="cosmos-root" style={{ display: "flex" } as CSSProperties}>
        <Sidebar
          activeId={activeId}
          identity={identity}
          onClose={closeNav}
          open={navOpen}
        />
        {navOpen && (
          <button
            aria-label="Fechar navegação"
            className="cosmos-scrim"
            onClick={closeNav}
            type="button"
          />
        )}
        <div
          // `inert` só existe fisicamente abaixo de 1024px (a media query em
          // cosmos.css que faz a gaveta flutuar); no desktop `navOpen` nunca
          // liga, então isto nunca desativa nada ali.
          inert={navOpen}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <Topbar
            activeId={activeId}
            navButtonRef={navButtonRef}
            onOpenNav={() => setNavOpen(true)}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            theme={theme}
          />
          {/* Scrollable regions need a tab stop, or keyboard-only users cannot
              scroll the screen content at all. Labelled so the stop announces
              what it is rather than landing on an anonymous group. */}
          <section
            aria-label="Conteúdo da tela"
            className="scroll cosmos-content"
            style={{ flex: 1, overflowY: "auto" }}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: axe's scrollable-region-focusable requires a focusable scroll container
            tabIndex={0}
          >
            {children}
          </section>
        </div>
      </div>
      <CommandPalette />
    </NavCtx.Provider>
  );
}
