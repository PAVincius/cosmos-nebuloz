"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Icon } from "@repo/design-system/cosmos/icons";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ClienteAchado } from "@/app/actions/clientes-busca";
import { useSaidaGuardada } from "@/lib/rascunho-sujo";
import type { Result } from "@/lib/safe-action";
import { ListaDaPaleta } from "./paleta-lista";

/**
 * Paleta de salto — Ctrl+K / ⌘+K.
 *
 * H7 (flexibilidade e eficiência) ficou em 2 por cinco rodadas da crítica:
 * quem sabia para onde queria ir atravessava a sidebar de 25 itens, ou abria
 * a carteira e buscava o cliente, a cada troca. Aqui a mesma ida é três
 * teclas. As telas vêm do `BO_NAV` (um lugar só, o mesmo da sidebar) e os
 * clientes de uma busca própria, curta, a partir de duas letras.
 *
 * O botão visível na topbar existe para quem não sabe do atalho — ele está
 * escrito no próprio botão. E a ida passa pela mesma guarda de rascunho do
 * menu: a paleta é mais uma porta de saída da tela, não um atalho em volta
 * da pergunta.
 */

/** A busca de clientes, injetada pelo `Shell` (servidor), que é quem pode
 *  importar a action. Sem ela a paleta lista só as telas. */
export type BuscarClientes = (
  termo: string
) => Promise<Result<ClienteAchado[]>>;

/** O atalho não é da paleta quando a pessoa está escrevendo: lá, Ctrl+K é do
 *  campo (e do navegador). */
function ehCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) {
    return false;
  }
  return (
    alvo.isContentEditable ||
    alvo.tagName === "INPUT" ||
    alvo.tagName === "TEXTAREA" ||
    alvo.tagName === "SELECT"
  );
}

function useAtalho(abrir: () => void): void {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const comando = evento.ctrlKey || evento.metaKey;
      if (
        !comando ||
        evento.altKey ||
        evento.shiftKey ||
        evento.key.toLowerCase() !== "k" ||
        ehCampoDeTexto(evento.target)
      ) {
        return;
      }
      evento.preventDefault();
      abrir();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [abrir]);
}

const SISTEMA_DA_APPLE = /Mac|iPhone|iPad/;

/** "⌘K" no Mac, "Ctrl K" no resto. Depois de montar: o servidor não sabe o
 *  sistema de quem lê, e decidir no render quebraria a hidratação. */
function useRotuloDoAtalho(): string {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(SISTEMA_DA_APPLE.test(navigator.userAgent));
  }, []);
  return mac ? "⌘K" : "Ctrl K";
}

const GATILHO: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
  height: 36,
  padding: "0 10px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "var(--surface)",
  color: "var(--ink-muted)",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  cursor: "pointer",
};

const TECLA: CSSProperties = {
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  padding: "1px 5px",
  borderRadius: 5,
  border: "1px solid var(--hairline)",
  color: "var(--ink-faint)",
};

export function Paleta({
  buscarClientes,
  telaAtual,
}: {
  buscarClientes?: BuscarClientes;
  /** Nome da tela aberta, para a pergunta de rascunho dizer o que se perde. */
  telaAtual: string;
}) {
  const [aberta, setAberta] = useState(false);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  // Quem tinha o foco antes de abrir: Ctrl+K no meio da tela e Esc devolvem a
  // pessoa para lá, não para a topbar. Sem esse alguém, o gatilho.
  const anterior = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const rotuloDoAtalho = useRotuloDoAtalho();

  const abrir = useCallback(() => {
    const foco = document.activeElement;
    anterior.current =
      foco instanceof HTMLElement && foco !== document.body ? foco : null;
    setAberta(true);
  }, []);
  useAtalho(abrir);

  const ir = useCallback(
    (href: string) => {
      setAberta(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Ir para…"
        className="btn"
        onClick={abrir}
        ref={gatilhoRef}
        style={GATILHO}
        type="button"
      >
        <Icon name="search" size={15} />
        <span className="bo-so-largo">Ir para…</span>
        <kbd className="mono" style={TECLA}>
          {rotuloDoAtalho}
        </kbd>
      </button>
      <Dialog onOpenChange={setAberta} open={aberta}>
        <DialogContent
          className="top-[12vh] translate-y-0 sm:max-w-xl"
          onCloseAutoFocus={(evento) => {
            evento.preventDefault();
            const volta = anterior.current?.isConnected
              ? anterior.current
              : gatilhoRef.current;
            volta?.focus();
          }}
          showCloseButton={false}
          style={{
            gap: 0,
            padding: 0,
            overflow: "hidden",
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: "var(--r-lg)",
            color: "var(--ink)",
          }}
        >
          <DialogTitle className="sr-only">Ir para</DialogTitle>
          <DialogDescription className="sr-only">
            Digite o nome de uma tela ou, a partir de duas letras, de um
            cliente. Setas escolhem, Enter vai, Esc fecha.
          </DialogDescription>
          {aberta ? (
            <CorpoDaPaleta
              aoIr={ir}
              buscarClientes={buscarClientes}
              telaAtual={telaAtual}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Montado só com a paleta aberta: fechar e abrir de novo começa do zero. */
function CorpoDaPaleta({
  aoIr,
  buscarClientes,
  telaAtual,
}: {
  aoIr: (href: string) => void;
  buscarClientes?: BuscarClientes;
  telaAtual: string;
}) {
  const saida = useSaidaGuardada(aoIr);
  const escolher = useCallback(
    (href: string) => {
      if (!saida.segurar(href)) {
        aoIr(href);
      }
    },
    [saida.segurar, aoIr]
  );

  return (
    <ListaDaPaleta
      buscarClientes={buscarClientes}
      onDescartar={saida.descartar}
      onEscolher={escolher}
      onVoltar={saida.voltar}
      pendente={saida.pendente}
      telaAtual={telaAtual}
    />
  );
}
