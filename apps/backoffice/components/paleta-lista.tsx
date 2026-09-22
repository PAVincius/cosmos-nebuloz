"use client";

import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useId,
  useState,
} from "react";
import type { ClienteAchado } from "@/app/actions/clientes-busca";
import { contemTexto } from "./busca";
import { BO_NAV } from "./nav";
import type { BuscarClientes } from "./paleta";
import { PerguntaDescartar } from "./pergunta-descartar";

/**
 * O miolo da paleta: o campo (`combobox`), a lista (`listbox`) e o que a
 * busca de clientes está fazendo.
 *
 * O foco nunca sai do campo — é o padrão de combobox da ARIA: as setas movem
 * a opção ativa e o campo aponta para ela com `aria-activedescendant`, que é
 * o que o leitor de tela anuncia. Clicar numa opção também vai, sem roubar o
 * foco do campo no caminho.
 */

type Destino = {
  href: string;
  rotulo: string;
  /** Seção do menu, ou o slug do cliente. */
  detalhe: string;
  icone: IconName;
};

const TELAS: Destino[] = BO_NAV.flatMap((grupo) =>
  grupo.items.map((item) => ({
    detalhe: grupo.section,
    href: item.href,
    icone: item.icon,
    rotulo: item.label,
  }))
);

const MINIMO_PARA_CLIENTE = 2;
/** Uma busca por pausa na digitação, não uma por tecla: cada uma passa pelo
 *  guard e pelo teto de requisições do staff. */
const ESPERA_DA_DIGITACAO = 200;

type BuscaDeClientes =
  | { estado: "ocioso" }
  | { estado: "buscando" }
  | { estado: "pronta"; clientes: ClienteAchado[] }
  | { estado: "falhou"; motivo: string };

function useClientes(
  termo: string,
  buscar: BuscarClientes | undefined
): BuscaDeClientes {
  const [busca, setBusca] = useState<BuscaDeClientes>({ estado: "ocioso" });
  useEffect(() => {
    const limpo = termo.trim();
    if (!buscar || limpo.length < MINIMO_PARA_CLIENTE) {
      setBusca({ estado: "ocioso" });
      return;
    }
    // Resposta de um termo que já mudou não pode pintar a lista do termo novo.
    let valendo = true;
    setBusca({ estado: "buscando" });
    const espera = setTimeout(async () => {
      let proxima: BuscaDeClientes;
      try {
        const res = await buscar(limpo);
        proxima = res.ok
          ? { clientes: res.data, estado: "pronta" }
          : { estado: "falhou", motivo: res.error };
      } catch {
        proxima = {
          estado: "falhou",
          motivo: "Sem resposta do servidor. Verifique a conexão.",
        };
      }
      if (valendo) {
        setBusca(proxima);
      }
    }, ESPERA_DA_DIGITACAO);
    return () => {
      valendo = false;
      clearTimeout(espera);
    };
  }, [termo, buscar]);
  return busca;
}

function paraDestino(cliente: ClienteAchado): Destino {
  return {
    detalhe: cliente.slug,
    href: `/clientes/${cliente.slug}`,
    icone: "building",
    rotulo: cliente.name,
  };
}

/** A linha de estado sob a lista — o que a busca está fazendo, dito. */
function situacao(
  termo: string,
  clientes: BuscaDeClientes,
  telas: number,
  comClientes: boolean
): string {
  const limpo = termo.trim();
  if (clientes.estado === "buscando") {
    return "Buscando clientes…";
  }
  if (clientes.estado === "falhou") {
    return `Não foi possível buscar clientes: ${clientes.motivo}`;
  }
  if (clientes.estado === "pronta" && clientes.clientes.length === 0) {
    return telas === 0
      ? `Nada com “${limpo}” — nem tela, nem cliente.`
      : `Nenhum cliente com “${limpo}”.`;
  }
  if (comClientes && limpo.length < MINIMO_PARA_CLIENTE) {
    return "Com duas letras, a busca inclui clientes por nome ou slug.";
  }
  return "";
}

const CAMPO: CSSProperties = {
  width: "100%",
  padding: "14px 16px 14px 42px",
  border: 0,
  borderBottom: "1px solid var(--hairline)",
  background: "transparent",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: "var(--fs-forte)",
};

/** O `fieldset` é o `group` da ARIA dentro do `listbox`, com o `legend` como
 *  nome — sem a moldura de formulário que ele traz de fábrica. */
const GRUPO: CSSProperties = {
  border: 0,
  margin: 0,
  padding: 0,
  minWidth: 0,
};

const ROTULO_DE_GRUPO: CSSProperties = {
  padding: "10px 12px 4px",
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
};

function estiloDaOpcao(ativa: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: "var(--r-sm)",
    cursor: "pointer",
    background: ativa ? "var(--accent-soft)" : "transparent",
    color: ativa ? "var(--accent-text)" : "var(--ink)",
    fontSize: "var(--fs-base)",
    fontWeight: ativa ? 700 : 600,
  };
}

function Opcao({
  destino,
  id,
  ativa,
  onEscolher,
  onApontar,
  mono,
}: {
  destino: Destino;
  id: string;
  ativa: boolean;
  onEscolher: () => void;
  onApontar: () => void;
  /** Slug de cliente é identificador — mono, como no resto do painel. */
  mono: boolean;
}) {
  // Fora do JSX: inline, o lint lê o ternário como valor vazando.
  const classeDoDetalhe = mono ? "mono" : undefined;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: combobox com `aria-activedescendant` — o teclado mora no campo (setas e Enter), a opção nunca recebe foco
    <div
      aria-selected={ativa}
      data-rotulo={destino.rotulo}
      id={id}
      onClick={onEscolher}
      // O foco fica no campo: sem isto o clique o levaria para a opção antes
      // de o `onClick` rodar.
      onMouseDown={(evento) => evento.preventDefault()}
      onMouseMove={onApontar}
      role="option"
      style={estiloDaOpcao(ativa)}
      tabIndex={-1}
    >
      <Icon name={destino.icone} size={15} />
      <span style={{ flex: 1, minWidth: 0 }}>{destino.rotulo}</span>
      <span
        className={classeDoDetalhe}
        style={{
          fontSize: "var(--fs-nota)",
          fontWeight: 500,
          color: ativa ? "var(--accent-text)" : "var(--ink-faint)",
        }}
      >
        {destino.detalhe}
      </span>
    </div>
  );
}

export function ListaDaPaleta({
  buscarClientes,
  telaAtual,
  pendente,
  onEscolher,
  onDescartar,
  onVoltar,
}: {
  buscarClientes?: BuscarClientes;
  telaAtual: string;
  /** Destino segurado pela guarda de rascunho — a pergunta entra no lugar da
   *  lista. */
  pendente: string | null;
  onEscolher: (href: string) => void;
  onDescartar: () => void;
  onVoltar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const clientes = useClientes(termo, buscarClientes);
  const base = useId();

  const telas = TELAS.filter((t) => contemTexto([t.rotulo, t.detalhe], termo));
  const achados =
    clientes.estado === "pronta" ? clientes.clientes.map(paraDestino) : [];
  const opcoes = [...telas, ...achados];
  const indice = opcoes.length === 0 ? -1 : Math.min(ativo, opcoes.length - 1);
  const idDaOpcao = (i: number) => `${base}-opcao-${i}`;
  const idDaLista = `${base}-lista`;

  useEffect(() => {
    if (indice >= 0) {
      document
        .getElementById(`${base}-opcao-${indice}`)
        ?.scrollIntoView?.({ block: "nearest" });
    }
  }, [base, indice]);

  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    const total = opcoes.length;
    if (evento.key === "ArrowDown" && total > 0) {
      evento.preventDefault();
      setAtivo((indice + 1) % total);
    } else if (evento.key === "ArrowUp" && total > 0) {
      evento.preventDefault();
      setAtivo((indice - 1 + total) % total);
    } else if (evento.key === "Enter" && indice >= 0) {
      evento.preventDefault();
      onEscolher(opcoes[indice].href);
    }
  };

  const texto = situacao(termo, clientes, telas.length, !!buscarClientes);
  // Fora do JSX pelo mesmo motivo do `classeDoDetalhe`.
  const ativaId = indice >= 0 ? idDaOpcao(indice) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ position: "relative" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 16,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink-faint)",
            display: "flex",
          }}
        >
          <Icon name="search" size={16} />
        </span>
        <input
          aria-activedescendant={ativaId}
          aria-autocomplete="list"
          aria-controls={idDaLista}
          aria-expanded="true"
          aria-label="Ir para uma tela ou cliente"
          autoComplete="off"
          onChange={(evento) => {
            setTermo(evento.target.value);
            setAtivo(0);
          }}
          onKeyDown={aoTeclar}
          placeholder="Tela ou cliente…"
          role="combobox"
          spellCheck={false}
          style={CAMPO}
          type="text"
          value={termo}
        />
      </div>

      {pendente === null ? null : (
        <div style={{ padding: 12 }}>
          <PerguntaDescartar
            explicacao="O que você editou nesta tela e ainda não salvou some. Para manter, volte e salve antes de sair."
            nome={telaAtual}
            onDescartar={onDescartar}
            onVoltar={onVoltar}
          />
        </div>
      )}

      <div
        aria-label="Telas e clientes"
        className="scroll"
        hidden={pendente !== null}
        id={idDaLista}
        role="listbox"
        style={{ maxHeight: "52vh", overflowY: "auto", padding: "4px 6px" }}
      >
        {telas.length > 0 ? (
          <fieldset style={GRUPO}>
            <legend className="mono" style={ROTULO_DE_GRUPO}>
              Telas
            </legend>
            {telas.map((destino, i) => (
              <Opcao
                ativa={i === indice}
                destino={destino}
                id={idDaOpcao(i)}
                key={destino.href}
                mono={false}
                onApontar={() => setAtivo(i)}
                onEscolher={() => onEscolher(destino.href)}
              />
            ))}
          </fieldset>
        ) : null}
        {achados.length > 0 ? (
          <fieldset style={GRUPO}>
            <legend className="mono" style={ROTULO_DE_GRUPO}>
              Clientes
            </legend>
            {achados.map((destino, j) => {
              const i = telas.length + j;
              return (
                <Opcao
                  ativa={i === indice}
                  destino={destino}
                  id={idDaOpcao(i)}
                  key={destino.href}
                  mono
                  onApontar={() => setAtivo(i)}
                  onEscolher={() => onEscolher(destino.href)}
                />
              );
            })}
          </fieldset>
        ) : null}
      </div>

      <p
        aria-live="polite"
        style={{
          margin: 0,
          minHeight: 34,
          padding: "8px 16px",
          borderTop: "1px solid var(--hairline)",
          fontSize: "var(--fs-nota)",
          color:
            clientes.estado === "falhou"
              ? "var(--red-text)"
              : "var(--ink-subtle)",
        }}
      >
        {texto}
      </p>
    </div>
  );
}
