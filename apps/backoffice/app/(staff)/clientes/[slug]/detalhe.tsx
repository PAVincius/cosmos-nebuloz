"use client";

import { Tabs } from "@repo/design-system/cosmos/kit";
import { type ReactNode, useState } from "react";
import type { TenantMemberRow } from "@/app/actions/tenant-members";
import type {
  AuditRow,
  IntegracaoRow,
} from "@/app/actions/tenant-observability";
import { Erro } from "@/components/campo";
import { AbaResumo } from "./abas/resumo";
import {
  AbaBilling,
  AbaMcp,
  AbaPoliticas,
  AbaSignal,
} from "./abas/sem-backend";
import { AbaUsuarios } from "./abas/usuarios";
import { AuditTimeline, Integracoes } from "./observabilidade";
import { SecaoSimples } from "./secao";

/**
 * Detalhe do tenant em abas — o `TenantDetailScreen` do handoff.
 *
 * Antes era uma lista plana de cinco cartões: tudo aberto ao mesmo tempo, e a
 * auditoria (a seção mais longa) empurrava o resto para fora da tela. As abas
 * do desenho separam por pergunta — quem usa, o que está contratado, o que
 * quebrou, o que mudou — e cada uma cabe numa tela.
 *
 * Cliente porque a aba é estado. Os dados chegam prontos do servidor: nenhuma
 * aba busca nada ao ser aberta, então trocar de aba é instantâneo e não
 * multiplica consulta.
 *
 * A contagem vai no rótulo (`Usuários · 4`) porque o `Tabs` do kit não tem slot
 * de contador como o do protótipo. Estender o kit por isso mexeria no Cosmos
 * junto; o rótulo resolve com o mesmo resultado para quem lê.
 */

type Aba = {
  id: string;
  label: string;
  conteudo: ReactNode;
};

export function DetalheDoTenant({
  slug,
  plano,
  modulos,
  membros,
  integracoes,
  auditoria,
  canWrite,
  acoesDeModulo,
  charter,
  meridian,
  contratados,
}: {
  slug: string;
  plano: string;
  modulos: { module: string; status: string; expiresAt: string | null }[];
  membros: { ok: true; data: TenantMemberRow[] } | { ok: false; error: string };
  integracoes:
    | { ok: true; data: IntegracaoRow[] }
    | { ok: false; error: string };
  auditoria: { ok: true; data: AuditRow[] } | { ok: false; error: string };
  canWrite: boolean;
  /** Formulário de módulos e bootstrap do Charter vêm montados de fora: são
   *  client components próprios, com as próprias actions. */
  acoesDeModulo: ReactNode;
  charter: ReactNode;
  meridian: ReactNode;
  /** Módulos contratados — decide quais abas de módulo existem, como no
   *  handoff (`...(t.modules.CHARTER ? [tab] : [])`). Aba de módulo que o
   *  cliente não comprou é rota morta no meio da navegação. */
  contratados: Set<string>;
}) {
  const [aba, setAba] = useState("resumo");

  const listaDeMembros = membros.ok ? membros.data : [];
  const listaDeIntegracoes = integracoes.ok ? integracoes.data : [];

  const abas: Aba[] = [
    {
      id: "resumo",
      label: "Resumo",
      conteudo: (
        <AbaResumo
          acoesDeModulo={acoesDeModulo}
          integracoes={listaDeIntegracoes}
          membros={listaDeMembros.length}
          modulos={modulos}
          plano={plano}
        />
      ),
    },
    {
      id: "usuarios",
      label: `Usuários · ${listaDeMembros.length}`,
      conteudo: membros.ok ? (
        <AbaUsuarios canWrite={canWrite} membros={membros.data} slug={slug} />
      ) : (
        <Erro>{membros.error}</Erro>
      ),
    },
    {
      id: "billing",
      label: "Planos & Billing",
      conteudo: <AbaBilling membros={listaDeMembros.length} plano={plano} />,
    },
    {
      id: "integracoes",
      label: `Integrações · ${listaDeIntegracoes.length}`,
      conteudo: (
        <SecaoSimples
          icone="eye"
          subtitulo="o back-office observa a integração; quem conecta é o cliente"
          titulo="Integrações e sincronização"
        >
          {integracoes.ok ? (
            <Integracoes integracoes={integracoes.data} />
          ) : (
            <Erro>{integracoes.error}</Erro>
          )}
        </SecaoSimples>
      ),
    },
    { id: "politicas", label: "Políticas", conteudo: <AbaPoliticas /> },
    { id: "mcp", label: "MCP", conteudo: <AbaMcp /> },
    ...(contratados.has("SIGNAL")
      ? [{ id: "signal", label: "Signal", conteudo: <AbaSignal /> }]
      : []),
    ...(contratados.has("CHARTER")
      ? [{ id: "charter", label: "Charter", conteudo: charter }]
      : []),
    ...(contratados.has("MERIDIAN")
      ? [{ id: "meridian", label: "Meridian", conteudo: meridian }]
      : []),
    {
      id: "audit",
      label: `Audit · ${auditoria.ok ? auditoria.data.length : 0}`,
      conteudo: (
        <SecaoSimples
          icone="history"
          subtitulo="cada linha expande no diff campo-a-campo"
          titulo="Auditoria"
        >
          {auditoria.ok ? (
            <AuditTimeline eventos={auditoria.data} />
          ) : (
            <Erro>{auditoria.error}</Erro>
          )}
        </SecaoSimples>
      ),
    },
  ];

  const atual = abas.find((a) => a.id === aba) ?? abas[0];

  return (
    <div>
      {/* O `Tabs` do kit é `flex` com `nowrap` e `overflow: visible`. Com nove
          abas isso transborda a 375px — medido: 357px de conteúdo em 343px de
          caixa, e a última aba fica inalcançável, sem rolagem que a traga.
          O envelope rola em vez de cortar. Não mexo no kit: ele é do Cosmos
          também, e lá as abas são poucas. */}
      <div className="scroll" style={{ overflowX: "auto", marginBottom: 16 }}>
        <Tabs
          active={aba}
          onChange={setAba}
          tabs={abas.map(({ id, label }) => ({ id, label }))}
        />
      </div>
      {atual.conteudo}
    </div>
  );
}
