"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import { Avatar, IconButton, NavCtx } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Eyebrow, StatusDot } from "./base";
import { NAV, navIdFor, TITLES } from "./nav";

// Casca do Scaffold. Port de `scaffold-shell.jsx`, com três diferenças
// deliberadas em relação ao protótipo:
//
//   1. O SELETOR DE PERSONA NÃO É PORTADO. No protótipo ele é ferramenta de
//      demo; em produção o papel vem da sessão (`ScaffoldRole`) — ADR-0004 e
//      `specs/002-scaffold-adoption/research.md` §R11. Quem comparar esta casca
//      com o mock vai sentir falta dele: a falta é a decisão.
//   2. A FILA DE GATES NÃO APARECE NA NAV. Ela é cross-tenant e vive em
//      `apps/backoffice/app/scaffold-supervision` — ADR-0013, research §R4.
//   3. O registry NÃO é importado aqui. Este arquivo é "use client"; as telas
//      são módulos pesados e arrastá-las para o bundle do cliente pela casca
//      desfaz o ganho de a rota ser única. Só as chaves cruzam a fronteira.

const THEME_KEY = "scaffold.theme";

type NavItem = { id: string; icon: string; label: string; count?: number };
type NavSection = { section: string; items: NavItem[] };

export type ScaffoldShellProps = {
  children: ReactNode;
  organization: string;
  user: { name: string; role: string };
  screenIds: string[];
  badges: Record<string, number>;
  stalledCount: number;
  totalTracks: number;
  stallThresholdDays: number;
};

function NavRow({
  item,
  active,
  href,
}: {
  item: NavItem;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="navitem btn"
      href={href}
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        borderRadius: "var(--r-sm)",
        textAlign: "left",
        fontSize: 13,
        textDecoration: "none",
        border: `1px solid ${active ? "rgba(var(--accent-rgb),.18)" : "transparent"}`,
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent-text)" : "var(--ink-muted)",
        fontWeight: active ? 700 : 500,
      }}
    >
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
      <Icon name={item.icon} size={15} strokeWidth={2} />
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.label}
      </span>
      {typeof item.count === "number" && item.count > 0 && (
        <span
          className="mono"
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: 99,
            background: active
              ? "rgba(var(--accent-rgb),.25)"
              : "var(--chip-bg)",
            color: active ? "var(--accent-text)" : "var(--ink-faint)",
          }}
        >
          {item.count}
        </span>
      )}
    </Link>
  );
}

export function ScaffoldShell({
  children,
  organization,
  user,
  screenIds,
  badges,
  stalledCount,
  totalTracks,
  stallThresholdDays,
}: ScaffoldShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  // `dark` é o default do produto; o tema escolhido é preferência do
  // navegador, não do tenant, então mora no localStorage e não no banco.
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
      }
    } catch {
      // Navegador com storage bloqueado continua usável no tema padrão.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // idem
      }
      return next;
    });
  }, []);

  const screenId = useMemo(
    () => pathname.split("/").filter(Boolean)[1] ?? "portfolio",
    [pathname]
  );
  const active = navIdFor(screenId);
  const [title, parent] = TITLES[screenId] ?? ["Scaffold", "Nebuloz"];

  const sections: NavSection[] = NAV.map((s) => ({
    section: s.section,
    items: s.items
      .filter((i) => screenIds.includes(i.id))
      .map((i) => ({ ...i, count: badges[i.id] })),
  })).filter((s) => s.items.length > 0);

  const navigate = useMemo(
    () => ({
      navigate: (screen: string, id?: string) =>
        router.push(`/scaffold/${screen}${id ? `/${id}` : ""}`),
      // Tela fora do registry cai em <ComingSoon> na rota; o kit usa isto para
      // desabilitar o controle em vez de oferecer um link morto.
      isComingSoon: (id: string) => !screenIds.includes(id),
    }),
    [router, screenIds]
  );

  return (
    <NavCtx.Provider value={navigate}>
      <div
        className="scaffold-root grain"
        data-theme={theme}
        style={{
          height: "100%",
          display: "grid",
          gridTemplate: '"bar bar" 56px "side main" 1fr / 248px 1fr',
          background: "var(--canvas)",
          color: "var(--ink)",
        }}
      >
        <header
          style={{
            gridArea: "bar",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 18px",
            borderBottom: "1px solid var(--hairline)",
            background: "var(--sidebar)",
            zIndex: 20,
          }}
        >
          <span
            className="display"
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              letterSpacing: "-.03em",
              color: "var(--ink)",
            }}
          >
            Scaffold
          </span>
          <span
            style={{ width: 1, height: 22, background: "var(--hairline)" }}
          />
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
            <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              {parent}
            </span>
            <Icon
              name="chevronRight"
              size={12}
              style={{ color: "var(--ink-faint)" }}
            />
            <span
              style={{
                fontSize: 12.5,
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
            <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              {organization}
            </span>
            <IconButton
              name={theme === "dark" ? "sun" : "moon"}
              onClick={toggleTheme}
              size={32}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            />
          </div>
        </header>

        <aside
          className="scroll"
          style={{
            gridArea: "side",
            overflowY: "auto",
            borderRight: "1px solid var(--hairline)",
            background: "var(--sidebar)",
            padding: "14px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {sections.map((sec) => (
            <div
              key={sec.section}
              style={{ display: "flex", flexDirection: "column", gap: 3 }}
            >
              <Eyebrow style={{ padding: "0 10px 5px" }}>{sec.section}</Eyebrow>
              {sec.items.map((item) => (
                <NavRow
                  active={active === item.id}
                  href={`/scaffold/${item.id}`}
                  item={item}
                  key={item.id}
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
            {/* Estagnação na casca, não numa tela: S-09 existe para ser vista
                sem ninguém procurar. */}
            <div
              style={{
                padding: "12px 13px",
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
              }}
            >
              <StatusDot
                label={
                  stalledCount
                    ? "Estagnação detectada"
                    : "Nenhuma trilha estagnada"
                }
                tone={stalledCount ? "red" : "green"}
              />
              <div
                className="mono"
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: stalledCount ? "var(--red-text)" : "var(--ink)",
                  letterSpacing: "-.01em",
                  marginTop: 7,
                }}
              >
                {stalledCount} de {totalTracks} trilhas
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                sem movimento de gate há ≥ {stallThresholdDays} dias
              </div>
            </div>

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
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-faint)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.role}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main
          className="scroll bg-grid"
          style={{
            gridArea: "main",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "24px 28px 48px",
          }}
        >
          <div style={{ maxWidth: 1420, margin: "0 auto" }}>{children}</div>
        </main>
      </div>
    </NavCtx.Provider>
  );
}
