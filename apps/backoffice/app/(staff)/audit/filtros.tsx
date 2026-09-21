"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { TenantOpcao } from "@/app/actions/audit";
import { BotaoSecundario, Campo, INPUT } from "@/components/campo";
import { PaginacaoEmLinks } from "@/components/paginacao-em-links";
import { ACOES, ENTIDADES } from "./rotulos";

/**
 * Filtros da trilha de auditoria.
 *
 * O estado mora na URL, não em `useState`. Um filtro de auditoria costuma
 * terminar colado num ticket ou num canal — com estado de cliente o link
 * abriria a tela em branco, e quem recebe teria de refazer o filtro no escuro.
 * Como efeito colateral, voltar no histórico desfaz o filtro, que é o que a
 * seta de voltar deveria fazer mesmo.
 *
 * O filtro muda o que o servidor lê, então a navegação fica — mas dentro de
 * `startTransition`: o `router.push` cru derrubava a tela no `loading.tsx`
 * da rota a cada troca de select. Com a transição a lista antiga continua na
 * tela, o bloco de filtros diz que está esperando (`aria-busy`), e a nova
 * chega no lugar.
 */

/** Os params que este bloco controla — o que "Limpar filtros" apaga. */
const CHAVES = ["tenant", "acao", "entidade", "de", "ate"] as const;

export function Filtros({ tenants }: { tenants: TenantOpcao[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendente, iniciarTransicao] = useTransition();

  const definir = useCallback(
    (chave: string, valor: string) => {
      const novo = new URLSearchParams(params.toString());
      if (valor) {
        novo.set(chave, valor);
      } else {
        novo.delete(chave);
      }
      // Trocar filtro volta para a página 1: manter a página anterior deixa a
      // tela vazia quando o novo filtro tem menos resultados, e parece que a
      // busca não achou nada.
      novo.delete("pagina");
      iniciarTransicao(() => {
        router.push(`${pathname}?${novo.toString()}`);
      });
    },
    [params, pathname, router]
  );

  const temFiltro = CHAVES.some((chave) => params.has(chave));
  const limpar = () => {
    iniciarTransicao(() => {
      router.push(pathname);
    });
  };

  const seletor = {
    ...INPUT,
    padding: "8px 10px",
    fontSize: "var(--fs-base)",
    cursor: "pointer",
  };

  return (
    <div
      aria-busy={pendente}
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        opacity: pendente ? 0.6 : 1,
        transition: "opacity .15s ease",
      }}
    >
      <Campo htmlFor="f-tenant" label="Cliente">
        <select
          id="f-tenant"
          onChange={(e) => definir("tenant", e.target.value)}
          style={seletor}
          value={params.get("tenant") ?? ""}
        >
          <option value="">Todos</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Campo>

      <Campo htmlFor="f-acao" label="Ação">
        <select
          id="f-acao"
          onChange={(e) => definir("acao", e.target.value)}
          style={seletor}
          value={params.get("acao") ?? ""}
        >
          <option value="">Todas</option>
          {Object.entries(ACOES).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </Campo>

      <Campo htmlFor="f-entidade" label="Entidade">
        <select
          id="f-entidade"
          onChange={(e) => definir("entidade", e.target.value)}
          style={seletor}
          value={params.get("entidade") ?? ""}
        >
          <option value="">Todas</option>
          {Object.entries(ENTIDADES).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </Campo>

      <Campo htmlFor="f-de" label="De">
        <input
          id="f-de"
          onChange={(e) => definir("de", e.target.value)}
          style={seletor}
          type="date"
          value={params.get("de") ?? ""}
        />
      </Campo>

      <Campo htmlFor="f-ate" label="Até">
        <input
          id="f-ate"
          onChange={(e) => definir("ate", e.target.value)}
          style={seletor}
          type="date"
          value={params.get("ate") ?? ""}
        />
      </Campo>

      {/* Sem isto, desfazer cinco filtros era voltar cinco selects para
          "Todos" um a um. Desabilitado quando não há o que limpar. */}
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <BotaoSecundario disabled={!temFiltro || pendente} onClick={limpar}>
          Limpar filtros
        </BotaoSecundario>
      </div>
    </div>
  );
}

/**
 * Anterior e Próxima em link, não em botão com `router.push`: meio-clique
 * abre em nova aba, a seta de voltar desfaz, e a página se cola num ticket
 * — o que o botão só imitava pela metade. Os filtros ficam, só `pagina` muda.
 */
export function Paginacao({
  pagina,
  porPagina,
  total,
}: {
  pagina: number;
  porPagina: number;
  total: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const ultima = Math.max(1, Math.ceil(total / porPagina));

  return (
    <PaginacaoEmLinks
      caminho={pathname}
      legenda={`página ${pagina} de ${ultima} · ${total} ${total === 1 ? "evento" : "eventos"}`}
      pagina={pagina}
      params={Object.fromEntries(params.entries())}
      porPagina={porPagina}
      temMais={pagina < ultima}
    />
  );
}
