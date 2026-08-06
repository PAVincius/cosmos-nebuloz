"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { TenantOpcao } from "@/app/actions/audit";
import { Campo, INPUT } from "@/components/campo";

/**
 * Filtros do Audit Explorer.
 *
 * O estado mora na URL, não em `useState`. Um filtro de auditoria costuma
 * terminar colado num ticket ou num canal — com estado de cliente o link
 * abriria a tela em branco, e quem recebe teria de refazer o filtro no escuro.
 * Como efeito colateral, voltar no histórico desfaz o filtro, que é o que a
 * seta de voltar deveria fazer mesmo.
 */

/** As ações que o painel realmente grava. Lista fechada em vez de campo livre:
 *  digitar "update" e não achar nada porque o valor é "updated" é frustração
 *  sem aprendizado. */
const ACOES = ["created", "updated", "deleted", "approved", "rejected"];

const ENTIDADES = [
  "tenant",
  "tenant_member",
  "tenant_module",
  "staff_diagram",
  "platform_approval",
];

export function Filtros({ tenants }: { tenants: TenantOpcao[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

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
      router.push(`${pathname}?${novo.toString()}`);
    },
    [params, pathname, router]
  );

  const seletor = {
    ...INPUT,
    padding: "8px 10px",
    fontSize: 12.5,
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
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
          {ACOES.map((a) => (
            <option key={a} value={a}>
              {a}
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
          {ENTIDADES.map((e) => (
            <option key={e} value={e}>
              {e}
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
    </div>
  );
}

export function Paginacao({
  pagina,
  porPagina,
  total,
}: {
  pagina: number;
  porPagina: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const ultima = Math.max(1, Math.ceil(total / porPagina));

  const ir = (destino: number) => {
    const novo = new URLSearchParams(params.toString());
    novo.set("pagina", String(destino));
    router.push(`${pathname}?${novo.toString()}`);
  };

  const botao = (rotulo: string, destino: number, ativo: boolean) => (
    <button
      className="btn"
      disabled={!ativo}
      onClick={() => ir(destino)}
      style={{
        padding: "6px 12px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
        color: ativo ? "var(--ink)" : "var(--ink-faint)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: ativo ? "pointer" : "not-allowed",
        opacity: ativo ? 1 : 0.5,
      }}
      type="button"
    >
      {rotulo}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        paddingTop: 12,
        borderTop: "1px solid var(--hairline)",
      }}
    >
      {botao("← Anterior", pagina - 1, pagina > 1)}
      <span
        className="mono"
        style={{ flex: 1, fontSize: 11, color: "var(--ink-faint)" }}
      >
        página {pagina} de {ultima} · {total} evento(s)
      </span>
      {botao("Próxima →", pagina + 1, pagina < ultima)}
    </div>
  );
}
