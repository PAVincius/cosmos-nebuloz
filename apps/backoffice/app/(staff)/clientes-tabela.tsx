"use client";

import {
  Avatar,
  Badge,
  KpiCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  type ClientRow,
  listClients,
  type OpcoesDaCarteira,
} from "@/app/actions/clients";
import { Busca, contemTexto } from "@/components/busca";
import { BotaoMostrarMais, usePaginas } from "@/components/mostrar-mais";
import { Vazio } from "@/components/vazio";
import {
  SituacaoDaBusca,
  useBuscaNoServidor,
  visiveisDaBusca,
} from "@/lib/busca-no-servidor";
import { formatarData } from "@/lib/data";
import { TETO_DA_LISTA } from "@/lib/paginacao";
import { useParamState } from "@/lib/url-state";

/**
 * Carteira de clientes — a tabela do `backoffice-tenant.jsx`.
 *
 * O protótipo mostra também setor, região e "health" por cliente. Nada disso
 * existe no schema, então nada disso aparece aqui: a alternativa seria a tela
 * afirmar coisas sobre o cliente que ninguém registrou, e um painel de
 * operação que inventa campo é pior que um painel com menos coluna.
 *
 * O que entra no lugar é o que é real: plano, número de membros e o status de
 * cada módulo contratado.
 *
 * Cliente, não servidor: a lista chega até o teto (`lib/paginacao.ts`) e
 * cresce daqui, uma página por "Mostrar mais". A busca (`?q=`, nome ou slug)
 * e o filtro do KPI "Exigem atenção" (`?atencao=1`) moram na URL — F5
 * mantém, e a lista filtrada vira link. A atenção é filtro do servidor (a
 * página relê a lista); a busca filtra aqui quando a carteira inteira está na
 * tela e pergunta ao servidor quando não está (`lib/busca-no-servidor.tsx`).
 */

/** `SubscriptionPlan` do schema é o nome do produto em caixa alta; a tela
 *  mostra o nome como se escreve. Plano fora do mapa aparece como veio, em
 *  vez de sumir. */
const ROTULO_DO_PLANO: Record<string, string> = {
  ORBIT: "Orbit",
  GALAXY: "Galaxy",
  NEBULA: "Nebula",
  UNIVERSE: "Universe",
};

const TOM_DE_STATUS: Record<string, Tone> = {
  ACTIVE: "green",
  TRIAL: "blue",
  SUSPENDED: "amber",
  CANCELED: "red",
};

const ROTULO_DE_STATUS: Record<string, string> = {
  ACTIVE: "Ativo",
  TRIAL: "Trial",
  SUSPENDED: "Suspenso",
  CANCELED: "Cancelado",
};

const CABECALHO: React.CSSProperties = {
  padding: "0 14px 8px",
  textAlign: "left",
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
};

const CELULA: React.CSSProperties = {
  padding: "11px 14px",
  borderTop: "1px solid var(--hairline)",
  fontSize: "var(--fs-base)",
  verticalAlign: "middle",
};

function exigeAtencao(cliente: ClientRow): boolean {
  return cliente.modules.some((m) => m.status === "SUSPENDED");
}

/** Fora do JSX: inline, o lint lê o ternário como valor vazando. */
function anelDePressionado(ativo: boolean): string | undefined {
  return ativo ? "0 0 0 2px rgba(var(--amber-rgb),.6)" : undefined;
}

/**
 * O KPI "Exigem atenção" é o filtro: pressionado, a tabela mostra só quem tem
 * módulo suspenso. Botão com `aria-pressed`, e o estado em `?atencao=1` —
 * o mesmo param que a tabela lê. Mora aqui, e não em `page.tsx`, porque a
 * página é servidor e o toggle precisa do hook de URL.
 */
export function KpiAtencao({ valor }: { valor: number }) {
  // `servidor`: o filtro é do banco (`listClients({ atencao })`), não da
  // página carregada — o suspenso que está na página 2 também aparece.
  const [atencao, setAtencao, pendente] = useParamState("atencao", "", {
    servidor: true,
  });
  const ativo = atencao === "1";
  return (
    <button
      aria-busy={pendente}
      aria-pressed={ativo}
      className="btn"
      onClick={() => setAtencao(ativo ? "" : "1")}
      style={{
        display: "block",
        width: "100%",
        padding: 0,
        border: 0,
        background: "none",
        font: "inherit",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: "var(--r-xl)",
        boxShadow: anelDePressionado(ativo),
      }}
      type="button"
    >
      <KpiCard
        hint={
          ativo
            ? "filtrando a tabela · clique para ver todos"
            : "módulos suspensos · clique para filtrar"
        }
        icon="alert"
        label="Exigem atenção"
        tone="amber"
        value={valor}
      />
    </button>
  );
}

/** O filtro de atenção só entra no argumento quando ligado: sem ele, a
 *  chamada é a de sempre. */
function naCarteira(
  soAtencao: boolean,
  resto: OpcoesDaCarteira
): OpcoesDaCarteira {
  return soAtencao ? { atencao: true, ...resto } : resto;
}

export function ClientesTabela({
  clientes,
  temMais = clientes.length >= TETO_DA_LISTA,
  total = null,
}: {
  clientes: ClientRow[];
  /** Há clientes além dos carregados (com o filtro de atenção, se ligado). */
  temMais?: boolean;
  /** A carteira inteira, contada no banco — o M do "N de M". */
  total?: number | null;
}) {
  const [lista, setLista] = useState(clientes);
  const [q, setQ] = useParamState("q");
  const [atencao] = useParamState("atencao");
  const soAtencao = atencao === "1";
  const ler = useCallback(
    (pagina: number) => listClients(naCarteira(soAtencao, { pagina })),
    [soAtencao]
  );
  const paginacao = usePaginas(ler, temMais);
  const mostrarMais = useCallback(async () => {
    const mais = await paginacao.proxima();
    if (mais) {
      setLista((atual) => [...atual, ...mais]);
    }
  }, [paginacao.proxima]);

  // Com a carteira inteira na tela, o filtro no navegador é exato e
  // instantâneo. Com mais do que está na tela, a busca pergunta ao servidor.
  const buscarNoServidor = useCallback(
    (termo: string) =>
      listClients(naCarteira(soAtencao, { busca: termo, pagina: 1 })),
    [soAtencao]
  );
  const busca = useBuscaNoServidor(
    q,
    paginacao.temMais ? buscarNoServidor : null
  );
  const carregados = lista.filter(
    (c) => (!soAtencao || exigeAtencao(c)) && contemTexto([c.name, c.slug], q)
  );
  const visiveis = visiveisDaBusca(busca, carregados);
  // O vazio aqui é o do filtro — a carteira sem cliente nenhum é da página
  // (`page.tsx`), que nem monta a tabela. Enquanto o servidor não responde,
  // zero no carregado não é zero na carteira. Fora do JSX: inline, o lint lê
  // o `&&` como valor vazando.
  const filtroZerou =
    (q !== "" || soAtencao) &&
    visiveis.length === 0 &&
    busca.estado !== "buscando";
  // "Mostrar mais" cresce a lista sem busca; com a resposta do servidor na
  // tela, ele cresceria o que não está à vista.
  const buscaNoServidor = paginacao.temMais && q.trim() !== "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Busca
        id="busca-cliente"
        onMudar={setQ}
        rotulo="Buscar cliente"
        total={total ?? lista.length}
        valor={q}
        visiveis={visiveis.length}
      />
      <SituacaoDaBusca busca={busca} onde="toda a carteira" termo={q} />
      {filtroZerou ? (
        <Vazio>
          {q
            ? `Nenhum cliente com “${q}”${soAtencao ? " entre os que exigem atenção" : ""}.`
            : "Nenhum cliente exige atenção."}
        </Vazio>
      ) : (
        <Tabela clientes={visiveis} />
      )}
      {buscaNoServidor ? null : (
        <BotaoMostrarMais
          carregando={paginacao.carregando}
          erro={paginacao.erro}
          onClick={mostrarMais}
          temMais={paginacao.temMais}
        />
      )}
    </div>
  );
}

function Tabela({ clientes }: { clientes: ClientRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="mono" scope="col" style={CABECALHO}>
              Cliente
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Slug
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Módulos
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Plano
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Membros
            </th>
            <th className="mono" scope="col" style={CABECALHO}>
              Desde
            </th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr className="lift" key={cliente.id}>
              <td style={CELULA}>
                <Link
                  href={`/clientes/${cliente.slug}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "var(--ink)",
                    textDecoration: "none",
                  }}
                >
                  <Avatar name={cliente.name} size={30} />
                  <span style={{ fontWeight: 700 }}>{cliente.name}</span>
                </Link>
              </td>
              <td
                className="mono"
                style={{
                  ...CELULA,
                  color: "var(--ink-subtle)",
                  fontSize: "var(--fs-base)",
                }}
              >
                {cliente.slug}
              </td>
              <td style={CELULA}>
                {cliente.modules.length === 0 ? (
                  <span
                    style={{
                      color: "var(--ink-faint)",
                      fontSize: "var(--fs-base)",
                    }}
                  >
                    nenhum módulo contratado
                  </span>
                ) : (
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {cliente.modules.map((m) => (
                      <Badge
                        dot
                        key={m.module}
                        tone={TOM_DE_STATUS[m.status] ?? "neutral"}
                      >
                        {m.module} · {ROTULO_DE_STATUS[m.status] ?? m.status}
                      </Badge>
                    ))}
                  </span>
                )}
              </td>
              <td style={CELULA}>
                <Badge soft={false} tone="purple">
                  {ROTULO_DO_PLANO[cliente.plan] ?? cliente.plan}
                </Badge>
              </td>
              <td
                className="mono"
                style={{ ...CELULA, fontSize: "var(--fs-base)" }}
              >
                {cliente.memberCount}
              </td>
              <td
                className="mono"
                style={{
                  ...CELULA,
                  color: "var(--ink-faint)",
                  fontSize: "var(--fs-base)",
                }}
              >
                {formatarData(cliente.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
