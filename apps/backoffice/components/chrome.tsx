"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, IconButton } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { MenuDoPerfil } from "./menu-do-perfil";
import { BO_NAV, FORA_DO_PAINEL, type NavItem } from "./nav";

/**
 * Topbar e sidebar do back-office, fiéis ao `backoffice-shell.jsx` do handoff.
 *
 * Cliente por dois motivos concretos, não por hábito: o alternador de tema
 * precisa de `useTheme`, e o item ativo da navegação precisa de `usePathname`.
 * O conteúdo continua sendo Server Component — entra por `children`.
 *
 * O protótipo navega por `onNavigate(id)` num SPA. Aqui são rotas de verdade,
 * então cada item é `<Link>`: volta a ganhar histórico, meio-clique e
 * pré-carregamento, que o handler do protótipo não tinha como dar.
 */

/** Ligação `aria-controls` do botão de menu com a gaveta, e alvo do foco ao
 *  abrir. Constante porque os dois lados precisam concordar. */
const ID_DA_GAVETA = "bo-gaveta";

/** Rótulo de seção em mono maiúsculo — o único "small caps" do desenho. */
function Eyebrow({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  tone?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className="mono"
      style={{
        fontSize: "var(--fs-micro)",
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: tone ? `var(--${tone}-text)` : "var(--ink-faint)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Se a rota atual pertence a este item de menu.
 *
 * Uma função só, usada pela trilha da topbar e pelo destaque da sidebar. Duas
 * cópias da mesma regra é o tipo de coisa que diverge quando alguém mexe numa
 * e esquece a outra — e o sintoma seria a topbar dizendo uma tela enquanto a
 * sidebar acende outra.
 */
function combina(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/clientes");
  }
  return pathname.startsWith(href);
}

/** Nome da tela quando o item é "Clientes" — o detalhe tem nome próprio.
 *  "Cliente" e "Provisionar cliente", como o menu e a carteira: a trilha dizia
 *  "Tenant" enquanto o item ao lado dizia "Clientes". */
function nomeDeClientes(pathname: string, label: string): string {
  if (!pathname.startsWith("/clientes/")) {
    return label;
  }
  return pathname === "/clientes/novo" ? "Provisionar cliente" : "Cliente";
}

/** Trilha "Seção › Tela" da topbar, derivada da rota atual. */
function trilha(pathname: string): [string, string] {
  for (const grupo of BO_NAV) {
    const item = grupo.items.find((i) => combina(i.href, pathname));
    if (item) {
      return [
        grupo.section,
        item.href === "/" ? nomeDeClientes(pathname, item.label) : item.label,
      ];
    }
  }
  return ["Nebuloz", "Back-office"];
}

function Topbar({
  staff,
  aoAbrirNav,
  botaoRef,
  gavetaAberta,
}: {
  staff: { name: string | null; email: string; canWrite: boolean };
  aoAbrirNav: () => void;
  botaoRef: RefObject<HTMLButtonElement | null>;
  gavetaAberta: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [secao, tela] = trilha(usePathname());
  const escuro = resolvedTheme !== "light";

  return (
    // O padding vive no CSS, não aqui: inline vence folha de estilo, e a media
    // query precisa poder apertá-lo quando a tela é estreita.
    <header
      className="bo-topbar"
      style={{
        gridArea: "bar",
        display: "flex",
        alignItems: "center",
        gap: 14,
        borderBottom: "1px solid var(--hairline)",
        background: "var(--sidebar)",
        minWidth: 0,
      }}
    >
      {/* `.cosmos-menu-btn` é `display:none` acima de 1024px — o botão só
          existe fisicamente onde a sidebar virou gaveta. */}
      <button
        aria-controls={ID_DA_GAVETA}
        aria-expanded={gavetaAberta}
        aria-label="Abrir navegação"
        className="cosmos-menu-btn btn navitem"
        onClick={aoAbrirNav}
        ref={botaoRef}
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: 36,
          height: 36,
          padding: 0,
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--hairline)",
          background: "var(--surface)",
          color: "var(--ink-muted)",
        }}
        type="button"
      >
        <Icon name="panelLeft" size={17} />
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
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
            name="key"
            size={14}
            strokeWidth={2.1}
            style={{ color: "var(--accent-fg)" }}
          />
        </span>
        <span
          className="display bo-so-largo"
          style={{
            fontSize: "var(--fs-forte)",
            fontWeight: 700,
            letterSpacing: ".1em",
          }}
        >
          NEBULOZ
        </span>
        <span
          className="mono bo-so-largo"
          style={{
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            letterSpacing: ".12em",
            padding: "3px 8px",
            borderRadius: 99,
            background: "var(--chip-bg)",
            border: "1px solid var(--hairline)",
            color: "var(--ink-subtle)",
          }}
        >
          BIG BANG
        </span>
      </div>

      {/* A trilha, o chip e o e-mail saem abaixo de 1024px (`bo-so-largo`).
          Numa topbar de 375px eles empurram o selo de permissão para fora da
          tela, e esse selo é o único aviso de que a sessão só lê. A trilha se
          paga menos ainda: a gaveta já mostra o item ativo. */}
      <span
        className="mono bo-so-largo"
        style={{
          fontSize: "var(--fs-nota)",
          color: "var(--ink-faint)",
          fontWeight: 600,
        }}
      >
        {secao} <span style={{ opacity: 0.5 }}>›</span>{" "}
        <span style={{ color: "var(--ink-muted)" }}>{tela}</span>
      </span>

      <div style={{ flex: 1 }} />

      {/* FR-0.4 — o operador precisa saber ANTES de clicar se a sessão dele
          escreve. MEMBER vendo botão apagado sem contexto acha que quebrou.

          Por isso o selo encurta em vez de sumir: numa topbar estreita fica só
          o papel, que com o ponto colorido ainda responde "eu escrevo aqui?".
          A frase inteira continua no `title` e volta inteira no desktop. */}
      <span
        style={{ flexShrink: 0 }}
        title={
          staff.canWrite
            ? "ADMIN · leitura e escrita"
            : "MEMBER · somente leitura"
        }
      >
        <Badge dot tone={staff.canWrite ? "green" : "amber"}>
          <span className="bo-so-largo">
            {staff.canWrite
              ? "ADMIN · leitura e escrita"
              : "MEMBER · somente leitura"}
          </span>
          <span className="bo-so-estreito">
            {staff.canWrite ? "ADMIN" : "MEMBER"}
          </span>
        </Badge>
      </span>

      <IconButton
        name={escuro ? "sun" : "moon"}
        onClick={() => setTheme(escuro ? "light" : "dark")}
        title={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      />

      {/* O protótipo troca de conta por aqui — era simulação. Com sessão de
          verdade, o que vale é quem está logado e o que dá para fazer com essa
          conta: ver o autenticador e sair. */}
      <MenuDoPerfil staff={staff} />
    </header>
  );
}

function ItemDeMenu({
  item,
  ativo,
  aoNavegar,
}: {
  item: NavItem;
  ativo: boolean;
  aoNavegar: () => void;
}) {
  // Fora do JSX porque `aria-current` só aceita "page" ou ausência — inline, o
  // ternário com undefined é lido pelo lint como valor vazando para o render.
  const atual: "page" | undefined = ativo ? "page" : undefined;
  return (
    <Link
      aria-current={atual}
      className="btn navitem"
      href={item.href}
      onClick={aoNavegar}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: ativo ? "var(--accent-soft)" : "none",
        border: "none",
        borderRadius: 9,
        padding: "8.5px 10px",
        color: ativo ? "var(--accent-text)" : "var(--ink-muted)",
        fontSize: "var(--fs-base)",
        fontWeight: ativo ? 700 : 600,
        textDecoration: "none",
      }}
    >
      <Icon name={item.icon} size={15.5} strokeWidth={ativo ? 2.1 : 1.9} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {/* A rota aparece mesmo sem implementação, com o motivo — é requisito do
          handoff, não descuido. Ver nav.ts. */}
      {item.pendente ? (
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            letterSpacing: ".08em",
            padding: "2px 5px",
            borderRadius: 5,
            border: "1px solid var(--hairline)",
            color: "var(--ink-faint)",
          }}
          title={item.pendente}
        >
          PENDENTE
        </span>
      ) : null}
    </Link>
  );
}

function Sidebar({
  aberta,
  aoFechar,
}: {
  // Abaixo de 1024px a nav vira gaveta; acima, `aberta` não tem efeito nenhum
  // porque as regras de posicionamento vivem dentro da media query.
  aberta: boolean;
  aoFechar: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="cosmos-sidebar scroll"
      data-open={aberta ? "true" : "false"}
      id={ID_DA_GAVETA}
      style={{
        gridArea: "side",
        // Largura explícita porque, como gaveta, a nav sai do grid e perde a
        // coluna de 236px que a dimensiona no desktop.
        width: 236,
        borderRight: "1px solid var(--hairline)",
        background: "var(--sidebar)",
        padding: "16px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        overflowY: "auto",
      }}
      tabIndex={-1}
    >
      {BO_NAV.map((grupo) => (
        <div
          key={grupo.section}
          style={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <div
            style={{
              padding: "0 10px 7px",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Eyebrow>{grupo.section}</Eyebrow>
          </div>
          {grupo.items.map((item) => (
            // Navegar fecha a gaveta. No `<Link>` e não no `<nav>` por
            // bubbling: assim um clique no espaço vazio da gaveta não a
            // fecha, e o alvo é interativo de verdade.
            <ItemDeMenu
              aoNavegar={aoFechar}
              ativo={combina(item.href, pathname)}
              item={item}
              key={item.href}
            />
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: 12,
          borderRadius: "var(--r-md)",
          border: "1px dashed var(--hairline-strong)",
          margin: "0 4px",
        }}
      >
        <Eyebrow tone="amber">Fora deste painel</Eyebrow>
        <p
          style={{
            margin: "7px 0 0",
            fontSize: "var(--fs-nota)",
            lineHeight: 1.55,
            color: "var(--ink-subtle)",
            fontWeight: 500,
          }}
        >
          {FORA_DO_PAINEL}
        </p>
      </div>
    </nav>
  );
}

/**
 * Shell do Big Bang com a navegação colapsável.
 *
 * Cliente porque a gaveta tem estado, e esse estado atravessa a topbar (o botão
 * que abre) e a sidebar (o que abre) — dois componentes que precisam do mesmo
 * booleano. O conteúdo continua Server Component: entra por `children`, já
 * renderizado, e só passa por aqui.
 *
 * Acima de 1024px nada disto existe: as regras que fazem a sidebar flutuar e o
 * scrim aparecer vivem numa media query do `cosmos.css`, e o botão de menu é
 * `display:none`. No desktop `aberta` nunca liga, e se ligasse não mudaria um
 * pixel.
 *
 * A gaveta é a do Cosmos, não uma segunda: `.cosmos-sidebar`, `.cosmos-scrim` e
 * `.cosmos-menu-btn` são as mesmas classes que o app usa. O back-office já
 * importa esse CSS e já tem `.cosmos-root` no `<body>`.
 */
export function ShellChrome({
  staff,
  children,
}: {
  staff: { name: string | null; email: string; canWrite: boolean };
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const botaoRef = useRef<HTMLButtonElement | null>(null);

  const fechar = useCallback(() => {
    setAberta((estava) => {
      // Devolve o foco ao gatilho. Sem isto, fechar por Escape ou pelo scrim
      // larga o teclado no início do documento.
      if (estava) {
        botaoRef.current?.focus();
      }
      return false;
    });
  }, []);

  useEffect(() => {
    if (!aberta) {
      return;
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        fechar();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    // Dois quadros, não zero e não um. `focus()` em elemento com
    // `visibility: hidden` é ignorado em silêncio, e a gaveta só fica visível
    // depois que o estilo do `data-open` recalcula. Medido nos três casos: sem
    // rAF o foco fica no botão, com um rAF cai no `<body>`, com dois entra na
    // gaveta. Um `transitionend` seria exato, mas não dispara com
    // `prefers-reduced-motion`, onde a transição não existe.
    let segundoQuadro = 0;
    const primeiroQuadro = requestAnimationFrame(() => {
      segundoQuadro = requestAnimationFrame(() => {
        document.getElementById(ID_DA_GAVETA)?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(primeiroQuadro);
      cancelAnimationFrame(segundoQuadro);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberta, fechar]);

  return (
    <div className="bo-shell">
      <Topbar
        aoAbrirNav={() => setAberta(true)}
        botaoRef={botaoRef}
        gavetaAberta={aberta}
        staff={staff}
      />
      <Sidebar aberta={aberta} aoFechar={fechar} />
      {aberta ? (
        <button
          aria-label="Fechar navegação"
          className="cosmos-scrim"
          onClick={fechar}
          type="button"
        />
      ) : null}
      {/* `inert` só tem o que desativar abaixo de 1024px, onde a gaveta cobre o
          conteúdo. No desktop `aberta` é sempre falso. */}
      <main
        className="scroll fade-in"
        inert={aberta}
        style={{ gridArea: "main", overflowY: "auto" }}
      >
        <div style={{ margin: "0 auto", maxWidth: 1180 }}>{children}</div>
      </main>
    </div>
  );
}

export { Eyebrow };
