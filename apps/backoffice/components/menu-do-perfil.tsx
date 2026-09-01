"use client";

import { authClient } from "@repo/auth/client";
import { Icon } from "@repo/design-system/cosmos/icons";
import { Avatar } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Menu da conta, na ponta direita da topbar.
 *
 * Existe porque o bloco do perfil era um `<span>`: mostrava quem estava logado
 * e não fazia mais nada. Não havia como sair do painel — nem como voltar à
 * tela do autenticador, que só é alcançável pelo portão de "falta o segundo
 * fator" e some depois que a pessoa cadastra.
 *
 * Abaixo de 1024px o nome e o e-mail somem da topbar (a topbar solta o
 * supérfluo para o selo de permissão caber). Por isso o menu repete os dois no
 * topo: aberto, ele é o único lugar onde a identidade aparece por extenso.
 */

const ITEM: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "9px 12px",
  border: "none",
  background: "none",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-muted)",
  fontFamily: "inherit",
  fontSize: "var(--fs-base)",
  fontWeight: 600,
  textAlign: "left",
  textDecoration: "none",
  cursor: "pointer",
};

export function MenuDoPerfil({
  staff,
}: {
  staff: { name: string | null; email: string };
}) {
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const idDoMenu = useId();

  /** `devolverFoco` só quando a saída foi do teclado — num clique fora, puxar
   *  o foco de volta para o botão roubaria o alvo que a pessoa acabou de mirar. */
  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false);
    setErro(null);
    if (devolverFoco) {
      botaoRef.current?.focus();
    }
  }, []);

  const itens = useCallback(
    () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
          []
      ),
    []
  );

  useEffect(() => {
    if (!aberto) {
      return;
    }

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        fechar(true);
        return;
      }
      // `role="menu"` promete seta para navegar. Sem isto o papel estaria
      // mentindo para quem usa leitor de tela.
      if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") {
        return;
      }
      evento.preventDefault();
      const lista = itens();
      if (lista.length === 0) {
        return;
      }
      const atual = lista.indexOf(document.activeElement as HTMLElement);
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      const proximo = (atual + passo + lista.length) % lista.length;
      lista[proximo]?.focus();
    };

    const aoApontar = (evento: MouseEvent) => {
      const alvo = evento.target as Node;
      if (menuRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) {
        return;
      }
      fechar(false);
    };

    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("mousedown", aoApontar);
    itens()[0]?.focus();
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("mousedown", aoApontar);
    };
  }, [aberto, fechar, itens]);

  /**
   * Sair encerra **esta** sessão, não todas.
   *
   * A varredura de todas as sessões existe em `/seguranca`, e lá tem motivo:
   * ao cadastrar o segundo fator é preciso derrubar o que foi aberto antes
   * dele. Sair do painel é outra coisa — quem clica aqui quer fechar este
   * navegador, e derrubar o celular junto seria um efeito que ninguém pediu.
   *
   * Falha não navega. Ir para `/sign-in` com o cookie ainda válido faria o
   * guard trazer a pessoa de volta ao painel, e ela leria isso como "o botão
   * de sair não funciona" — sem nada explicando.
   */
  const sair = async () => {
    setSaindo(true);
    setErro(null);
    try {
      await authClient.signOut();
    } catch {
      setSaindo(false);
      setErro("Não foi possível sair. Tente de novo.");
      return;
    }
    // Navegação dura: o cookie acabou de ser invalidado e quem precisa reler é
    // o servidor, no guard.
    window.location.assign("/sign-in");
  };

  // Fora do JSX pelo mesmo motivo que o `aria-current` do ItemDeMenu: inline, o
  // ternário com undefined é lido pelo lint como valor vazando para o render.
  // E apontar para um id que não existe enquanto o menu está fechado seria ARIA
  // quebrada, então o atributo some junto com o menu.
  const controla: string | undefined = aberto ? idDoMenu : undefined;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        aria-controls={controla}
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-label={`Conta de ${staff.name || staff.email}`}
        className="btn"
        onClick={() => setAberto((estava) => !estava)}
        ref={botaoRef}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          border: "1px solid var(--hairline)",
          background: aberto ? "var(--surface-2)" : "none",
          borderRadius: 99,
          padding: "4px 10px 4px 4px",
          color: "var(--ink)",
          fontFamily: "inherit",
          cursor: "pointer",
        }}
        type="button"
      >
        <Avatar name={staff.name || staff.email} size={26} />
        <span className="bo-so-largo" style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--fs-base)",
              fontWeight: 700,
            }}
          >
            {staff.name?.split(" ")[0] || "—"}
          </span>
          <span
            className="mono"
            style={{
              display: "block",
              fontSize: "var(--fs-micro)",
              color: "var(--ink-faint)",
            }}
          >
            {staff.email}
          </span>
        </span>
        <Icon
          name="chevronDown"
          size={14}
          style={{
            color: "var(--ink-faint)",
            transform: aberto ? "rotate(180deg)" : "none",
            transition: "transform .18s ease",
          }}
        />
      </button>

      {aberto ? (
        // `zIndex` não é enfeite: a topbar vem antes do `<main>` no DOM e, sem
        // ele, o conteúdo da tela pinta por cima do menu.
        <div
          id={idDoMenu}
          ref={menuRef}
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 50,
            minWidth: 232,
            padding: 6,
            background: "var(--surface)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <div
            style={{
              padding: "8px 12px 10px",
              borderBottom: "1px solid var(--hairline)",
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
              {staff.name || "Sem nome"}
            </div>
            <div
              className="mono"
              style={{
                fontSize: "var(--fs-micro)",
                color: "var(--ink-faint)",
                overflowWrap: "anywhere",
              }}
            >
              {staff.email}
            </div>
          </div>

          <Link
            className="navitem"
            href="/seguranca"
            onClick={() => fechar(false)}
            role="menuitem"
            style={ITEM}
          >
            <Icon name="shield" size={15} />
            Aplicativo autenticador
          </Link>

          <button
            className="navitem"
            disabled={saindo}
            onClick={sair}
            role="menuitem"
            style={{
              ...ITEM,
              color: "var(--red-text)",
              opacity: saindo ? 0.6 : 1,
            }}
            type="button"
          >
            <Icon name="logout" size={15} />
            {saindo ? "Saindo…" : "Sair"}
          </button>

          {erro ? (
            <p
              style={{
                margin: "4px 6px 2px",
                fontSize: "var(--fs-nota)",
                color: "var(--red-text)",
                lineHeight: 1.5,
              }}
            >
              {erro}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
