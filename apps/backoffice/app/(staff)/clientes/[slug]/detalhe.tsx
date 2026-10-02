"use client";

import { type KeyboardEvent, type ReactNode, useRef } from "react";
import type { TenantMemberRow } from "@/app/actions/tenant-members";
import type {
  AuditRow,
  IntegracaoRow,
} from "@/app/actions/tenant-observability";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { useParamState } from "@/lib/url-state";
import { AbaResumo } from "./abas/resumo";
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
 * A aba mora em `?aba=` (padrão Resumo, sem param): F5 devolve a mesma aba, e
 * "aba Usuários do cliente X" vira um link que cabe num ticket. Aba que não
 * existe no param — ou que o contrato não dá mais — cai em Resumo.
 *
 * A contagem vai no rótulo (`Usuários · 4`) porque a faixa segue a aparência
 * do `Tabs` do kit, que não tem slot de contador como o do protótipo. O rótulo
 * resolve com o mesmo resultado para quem lê.
 *
 * O handoff desenha nove abas. Quatro ficaram de fora — MCP, Políticas,
 * Ambientes e defaults do Signal — porque leem de estruturas que não existem no
 * schema: no protótipo os valores vêm de um objeto de mock. Aba que não lê nada
 * é promessa que a navegação não cumpre, e custa uma parada a cada vez que
 * alguém a abre para conferir. Elas voltam quando o modelo existir.
 */

type Aba = {
  id: string;
  label: string;
  conteudo: ReactNode;
  /** A leitura da aba falhou: o rótulo diz "—" em vez de uma contagem, e o
   *  motivo vai junto — no `title` e para o leitor de tela. */
  motivo?: string;
};

/**
 * A faixa de abas, com os papéis que o `Tabs` do kit não tem: `tablist`,
 * `tab` com `aria-selected`/`aria-controls`, foco só na ativa (roving
 * tabindex) e setas trocando de aba. O kit é `<button>` puro e não aceita
 * `role` nem `aria-*` por prop; envolver com `tablist` sem `tab` dentro é
 * ARIA inválido. A aparência é a do kit, literal — quando ele ganhar os
 * papéis, isto volta a ser `<Tabs>`.
 */
/** O `title` da aba cuja leitura falhou. Função, e não ternário no JSX: o
 *  lint lê o ternário inline como valor vazando para o render. */
function dicaDaAba(motivo: string | undefined): string | undefined {
  return motivo ? `Não carregou: ${motivo}` : undefined;
}

function FaixaDeAbas({
  abas,
  ativa,
  onMudar,
}: {
  abas: { id: string; label: string; motivo?: string }[];
  ativa: string;
  onMudar: (id: string) => void;
}) {
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const irPara = (id: string) => {
    onMudar(id);
    refs.current.get(id)?.focus();
  };

  const aoTeclar = (e: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const ultimo = abas.length - 1;
    const destino = {
      ArrowRight: indice === ultimo ? 0 : indice + 1,
      ArrowLeft: indice === 0 ? ultimo : indice - 1,
      Home: 0,
      End: ultimo,
    }[e.key];
    if (destino === undefined) {
      return;
    }
    e.preventDefault();
    irPara(abas[destino].id);
  };

  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--hairline)",
        marginBottom: 16,
      }}
    >
      {abas.map((t, i) => {
        const selecionada = ativa === t.id;
        return (
          <button
            aria-controls={`painel-${t.id}`}
            aria-selected={selecionada}
            id={`aba-${t.id}`}
            key={t.id}
            onClick={() => onMudar(t.id)}
            onKeyDown={(e) => aoTeclar(e, i)}
            ref={(el) => {
              if (el) {
                refs.current.set(t.id, el);
              } else {
                refs.current.delete(t.id);
              }
            }}
            role="tab"
            style={{
              padding: "8px 14px",
              fontSize: "var(--fs-base)",
              fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: selecionada
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              color: selecionada ? "var(--ink)" : "var(--ink-muted)",
              cursor: "pointer",
            }}
            tabIndex={selecionada ? 0 : -1}
            title={dicaDaAba(t.motivo)}
            type="button"
          >
            {t.label}
            {t.motivo ? (
              <span className="sr-only"> (não carregou: {t.motivo})</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function DetalheDoTenant({
  slug,
  modulos,
  membros,
  integracoes,
  auditoria,
  canWrite,
  acoesDeModulo,
  charter,
  meridian,
  scaffold,
  contratados,
}: {
  slug: string;
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
  scaffold?: ReactNode;
  /** Módulos contratados — decide quais abas de módulo existem, como no
   *  handoff (`...(t.modules.CHARTER ? [tab] : [])`). Aba de módulo que o
   *  cliente não comprou é rota morta no meio da navegação. */
  contratados: Set<string>;
}) {
  // Raso (padrão do hook): as três leituras já vieram no primeiro render, e
  // trocar de aba não tem o que buscar no servidor — antes passava pelo
  // `loading.tsx` inteiro para mostrar o que já estava na página.
  const [aba, setAba] = useParamState("aba", "resumo");

  // Leitura que falhou não é lista vazia: "Usuários · 0" afirmaria que o
  // cliente não tem ninguém quando só não deu para ler. A contagem vira "—" e
  // o motivo vai no rótulo, como a aba de auditoria já fazia.
  const contagem = (leitura: { ok: true; data: unknown[] } | { ok: false }) =>
    leitura.ok ? String(leitura.data.length) : "—";
  const motivoDe = (leitura: { ok: true } | { ok: false; error: string }) =>
    leitura.ok ? undefined : leitura.error;

  const abas: Aba[] = [
    {
      id: "resumo",
      label: "Resumo",
      conteudo: (
        <AbaResumo
          acoesDeModulo={acoesDeModulo}
          integracoes={integracoes}
          modulos={modulos}
        />
      ),
    },
    {
      id: "usuarios",
      label: `Usuários · ${contagem(membros)}`,
      motivo: motivoDe(membros),
      conteudo: membros.ok ? (
        <AbaUsuarios canWrite={canWrite} membros={membros.data} slug={slug} />
      ) : (
        <FalhaAoCarregar
          motivo={membros.error}
          titulo="Não foi possível ler os usuários"
        />
      ),
    },
    {
      id: "integracoes",
      label: `Integrações · ${contagem(integracoes)}`,
      motivo: motivoDe(integracoes),
      conteudo: (
        <SecaoSimples
          icone="eye"
          subtitulo="o back-office observa a integração; quem conecta é o cliente"
          titulo="Integrações e sincronização"
        >
          {integracoes.ok ? (
            <Integracoes integracoes={integracoes.data} />
          ) : (
            <FalhaAoCarregar
              motivo={integracoes.error}
              titulo="Não foi possível ler as integrações"
            />
          )}
        </SecaoSimples>
      ),
    },
    ...(contratados.has("CHARTER")
      ? [{ id: "charter", label: "Charter", conteudo: charter }]
      : []),
    ...(contratados.has("MERIDIAN")
      ? [{ id: "meridian", label: "Meridian", conteudo: meridian }]
      : []),
    ...(contratados.has("SCAFFOLD")
      ? [{ id: "scaffold", label: "Scaffold", conteudo: scaffold }]
      : []),
    {
      id: "audit",
      // O nome do menu, não "Audit". E leitura que falhou não é zero evento:
      // "0" afirmaria que o cliente não tem trilha quando só não deu para ler.
      label: `Trilha de auditoria · ${contagem(auditoria)}`,
      motivo: motivoDe(auditoria),
      conteudo: (
        <SecaoSimples
          icone="history"
          subtitulo="cada linha expande no diff campo-a-campo"
          titulo="Auditoria"
        >
          {auditoria.ok ? (
            <AuditTimeline eventos={auditoria.data} />
          ) : (
            <FalhaAoCarregar
              motivo={auditoria.error}
              titulo="Não foi possível ler a trilha"
            />
          )}
        </SecaoSimples>
      ),
    },
  ];

  const atual = abas.find((a) => a.id === aba) ?? abas[0];

  return (
    <div>
      {/* A faixa é `flex` com `nowrap` e `overflow: visible` — quando o
          conteúdo passa da caixa, ela corta e não há rolagem que traga a
          última aba de volta.

          Com as seis abas de hoje não transborda, mas por nada: medido a 375px,
          343px de conteúdo em 343px de caixa. O número de abas é variável
          (Charter, Meridian e Signal aparecem por contrato) e as contagens
          crescem no rótulo — "Usuários · 128" é mais largo que "Usuários · 3".
          O envelope rola em vez de cortar. */}
      <div className="scroll" style={{ overflowX: "auto", marginBottom: 16 }}>
        <FaixaDeAbas
          abas={abas.map(({ id, label, motivo }) => ({ id, label, motivo }))}
          ativa={atual.id}
          onMudar={setAba}
        />
      </div>
      <div
        aria-labelledby={`aba-${atual.id}`}
        id={`painel-${atual.id}`}
        role="tabpanel"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: padrão APG de abas — painel sem nada focável dentro (Resumo só lê, Integrações é tabela) ficava fora do Tab, e o Tab depois da faixa pulava o conteúdo inteiro
        tabIndex={0}
      >
        {atual.conteudo}
      </div>
    </div>
  );
}
