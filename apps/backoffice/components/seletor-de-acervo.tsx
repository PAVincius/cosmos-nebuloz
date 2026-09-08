"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { type ComponentProps, Fragment, type ReactNode, useState } from "react";

/**
 * Lista de acervo acima do conteúdo, em vez de barra lateral.
 *
 * A barra de 280px queimava largura o tempo todo para mostrar uma lista, e o
 * que precisa de largura nestas telas é o outro lado — editor de markdown,
 * modelador BPMN. Empilhada, a lista usa a linha inteira em colunas
 * automáticas: numa tela larga aparecem vários itens por linha, em vez de uma
 * coluna alta e estreita.
 *
 * Colapsa ao selecionar porque lista longa em largura cheia empurraria o
 * conteúdo para fora da tela — que é o problema que a barra lateral resolvia
 * mal, mas resolvia.
 *
 * `renderExtra` (opcional) deixa a tela anexar conteúdo por item — badges,
 * dono, ação de reuso — sem que a tela precise manter uma segunda lista só
 * para isso. Aparece tanto na grade expandida quanto, para o item
 * selecionado, na linha recolhida: é o item aberto no editor logo abaixo, e
 * esconder a ação ali obrigaria a clicar em "Trocar" para alcançá-la de novo.
 */

export type ItemDoAcervo = {
  id: string;
  titulo: string;
  /** Linha secundária, em mono. Ex.: "PLAYBOOK · v3 · EN-041". */
  detalhe: string;
};

const BOTAO_TROCAR: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "none",
  color: "var(--ink-muted)",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  cursor: "pointer",
};

function ItemBotao({
  item,
  selecionado,
  onSelecionar,
}: {
  item: ItemDoAcervo;
  selecionado: boolean;
  onSelecionar: () => void;
}) {
  return (
    <button
      aria-pressed={selecionado}
      className="btn navitem"
      onClick={onSelecionar}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 4,
        textAlign: "left",
        padding: "9px 11px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${selecionado ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`,
        background: selecionado ? "var(--accent-soft)" : "var(--surface-2)",
        color: "var(--ink)",
      }}
      type="button"
    >
      <span style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
        {item.titulo}
      </span>
      <span
        className="mono"
        style={{ fontSize: "var(--fs-micro)", color: "var(--ink-faint)" }}
      >
        {item.detalhe}
      </span>
    </button>
  );
}

/** `extra` fica fora do `<button>` — não dá para aninhar controles
 *  interativos (badges, botão de reuso) dentro de outro elemento clicável. */
function LinhaDoItem({
  item,
  selecionado,
  onSelecionar,
  extra,
}: {
  item: ItemDoAcervo;
  selecionado: boolean;
  onSelecionar: () => void;
  extra?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <ItemBotao
        item={item}
        onSelecionar={onSelecionar}
        selecionado={selecionado}
      />
      {extra}
    </div>
  );
}

export function SeletorDeAcervo({
  itens,
  selecionadoId,
  onSelecionar,
  titulo,
  subtitulo,
  icone,
  vazio,
  acao,
  formulario,
  renderExtra,
}: {
  itens: ItemDoAcervo[];
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
  titulo: string;
  /** Contagem com a palavra da tela ("3 ativo(s)"), em vez de um genérico. */
  subtitulo?: string;
  /** Nome do ícone do kit — o mesmo conjunto fechado que `SectionCard` aceita. */
  icone: ComponentProps<typeof SectionCard>["icon"];
  /** Texto do estado vazio — cada tela explica o próprio acervo. */
  vazio: string;
  /** Botão de "Novo"/"Cancelar" da tela, no canto do card. */
  acao?: ReactNode;
  /** Formulário de criação, quando a tela o abre. */
  formulario?: ReactNode;
  /** Conteúdo extra por item (badges, ações), pelo id do item. Opcional —
   *  quem não passar mantém a lista como sempre foi (ex.: `estudio.tsx`). */
  renderExtra?: (id: string) => ReactNode;
}) {
  const [reabertoManual, setReabertoManual] = useState(false);

  // Com formulário aberto a lista fica visível: o item recém-criado aparece
  // nela, e recolher no mesmo instante esconderia o resultado da ação.
  const expandido = Boolean(formulario) || !selecionadoId || reabertoManual;

  const selecionado = itens.find((i) => i.id === selecionadoId) ?? null;

  return (
    <SectionCard
      action={acao}
      icon={icone}
      subtitle={subtitulo ?? `${itens.length} item(ns)`}
      title={titulo}
    >
      {expandido ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {formulario}
          {itens.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "18px 4px",
                fontSize: "var(--fs-base)",
                lineHeight: 1.6,
                color: "var(--ink-muted)",
              }}
            >
              {vazio}
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
              }}
            >
              {itens.map((i) => (
                <LinhaDoItem
                  extra={renderExtra?.(i.id)}
                  item={i}
                  key={i.id}
                  onSelecionar={() => {
                    setReabertoManual(false);
                    onSelecionar(i.id);
                  }}
                  selecionado={i.id === selecionadoId}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "var(--fs-base)",
                  fontWeight: 700,
                }}
              >
                {selecionado ? selecionado.titulo : ""}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: "var(--fs-micro)",
                  color: "var(--ink-faint)",
                }}
              >
                {selecionado ? selecionado.detalhe : ""}
              </span>
            </span>
            <button
              className="btn"
              onClick={() => setReabertoManual(true)}
              style={BOTAO_TROCAR}
              type="button"
            >
              Trocar
            </button>
          </div>
          {selecionado ? (
            <Fragment key={selecionado.id}>
              {renderExtra?.(selecionado.id)}
            </Fragment>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
