"use client";

import { Badge, Progress, SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { AvaliacaoDetalhe } from "@/app/actions/maturidade";
import { concluirAvaliacao, responder } from "@/app/actions/maturidade";
import { Erro, INPUT, mensagemDeErro } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { WriteButton } from "@/components/write-button";
import { PORTAS } from "@/lib/comercial/funil";
import {
  CODIGOS_NIVEL,
  type Criterio,
  DIMENSOES,
  INFO_DIMENSAO,
  INFO_NIVEL,
  NIVEIS,
  type Nivel,
  pontuar,
  type Resultado,
  RUBRICA_V1,
  rubricaDe,
  type ScoreDaDimensao,
} from "@/lib/growth/maturidade";

type Estado = Record<string, { nivel: number; nota: string | null }>;

/** Rótulo e tom do nível a partir do código (INICIAL … OTIMIZADO). */
function infoDoCodigo(codigo: string | null) {
  const i = CODIGOS_NIVEL.indexOf(codigo as (typeof CODIGOS_NIVEL)[number]);
  return i === -1 ? null : INFO_NIVEL[i as Nivel];
}

/** Botão de nível. Cinco por critério, um selecionado por vez. */
function BotaoNivel({
  nivel,
  ativo,
  desabilitado,
  onClick,
}: {
  nivel: Nivel;
  ativo: boolean;
  desabilitado: boolean;
  onClick: () => void;
}) {
  const info = INFO_NIVEL[nivel];
  return (
    <button
      aria-pressed={ativo}
      disabled={desabilitado}
      onClick={onClick}
      style={{
        flex: 1,
        padding: "7px 6px",
        borderRadius: "var(--r-sm)",
        border: `1px solid ${ativo ? `var(--${info.tom})` : "var(--hairline)"}`,
        background: ativo ? `var(--${info.tom}-soft)` : "var(--surface-2)",
        color: ativo ? `var(--${info.tom}-text)` : "var(--ink-muted)",
        fontFamily: "inherit",
        fontSize: "var(--fs-nota)",
        fontWeight: 700,
        cursor: desabilitado ? "not-allowed" : "pointer",
        opacity: desabilitado ? 0.6 : 1,
      }}
      title={info.definicao}
      type="button"
    >
      {nivel} · {info.rotulo}
    </button>
  );
}

/** Uma barra por dimensão, com o peso à vista: sem ele o leitor não tem como
 *  saber por que 60 em Dados dói mais do que 60 em Cultura. */
function BarraDaDimensao({ d }: { d: ScoreDaDimensao }) {
  const info = INFO_DIMENSAO[d.dimensao];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "var(--fs-nota)",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
          {info.rotulo}
          <span
            className="mono"
            style={{ color: "var(--ink-faint)", marginLeft: 8 }}
          >
            peso {info.pesoPercent}
          </span>
        </span>
        <span className="mono" style={{ color: "var(--ink-muted)" }}>
          {d.score ?? `— · ${d.respondidos}/${d.total}`}
        </span>
      </div>
      <Progress tone={info.tom} value={d.score ?? 0} />
    </div>
  );
}

/** Um critério: pergunta, pista, cinco níveis e a evidência.
 *
 *  O campo de evidência só aparece depois de haver nível — pedir a prova de
 *  uma resposta que ainda não existe é ruído. */
function LinhaDoCriterio({
  criterio,
  resposta,
  travado,
  onGravar,
}: {
  criterio: Criterio;
  resposta: { nivel: number; nota: string | null } | undefined;
  travado: boolean;
  onGravar: (nivel: number, nota: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-forte)",
            fontWeight: 600,
            color: "var(--ink)",
          }}
        >
          {criterio.pergunta}
        </p>
        <p
          style={{
            margin: "3px 0 0",
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
          }}
        >
          {criterio.pista}
        </p>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {NIVEIS.map((n) => (
          <BotaoNivel
            ativo={resposta?.nivel === n}
            desabilitado={travado}
            key={n}
            nivel={n}
            onClick={() => onGravar(n, resposta?.nota ?? null)}
          />
        ))}
      </div>
      {resposta ? (
        <input
          aria-label={`Evidência — ${criterio.pergunta}`}
          defaultValue={resposta.nota ?? ""}
          disabled={travado}
          maxLength={600}
          onBlur={(e) => {
            const nota = e.target.value.trim() || null;
            if (nota !== (resposta.nota ?? null)) {
              onGravar(resposta.nivel, nota);
            }
          }}
          placeholder="Evidência que sustenta esse nível"
          style={{ ...INPUT, fontWeight: 500 }}
        />
      ) : null}
    </div>
  );
}

/** A ação do cartão de resultado: selo quando fechada, barreira quando
 *  aberta. Fora do JSX para o ternário não virar valor vazando no render. */
function concluirOuSelo({
  concluida,
  podeEscrever,
  salvando,
  pronta,
  organizacao,
  onConcluir,
}: {
  concluida: boolean;
  podeEscrever: boolean;
  salvando: boolean;
  pronta: boolean;
  organizacao: string;
  onConcluir: () => void;
}) {
  if (concluida) {
    return <Badge tone="green">Fechada</Badge>;
  }
  if (!podeEscrever) {
    return <WriteButton canWrite={false}>Concluir avaliação</WriteButton>;
  }
  return (
    <ConfirmarAcao
      alvo={organizacao}
      consequencia="O score fica congelado; critérios não podem mais ser editados."
      desabilitado={!pronta}
      executando={salvando}
      onConfirmar={onConcluir}
      rotulo={salvando ? "Fechando…" : "Concluir avaliação"}
      tom="accent"
    />
  );
}

/**
 * Score, nível e as seis barras.
 *
 * Concluída mostra o número congelado no fecho; rascunho mostra o que as
 * respostas dizem agora. Misturar os dois faria a tela contradizer o
 * relatório que já foi entregue.
 */
function PainelDeResultado({
  inicial,
  resultado,
  concluida,
  podeEscrever,
  salvando,
  onConcluir,
}: {
  inicial: AvaliacaoDetalhe;
  resultado: Resultado;
  concluida: boolean;
  podeEscrever: boolean;
  salvando: boolean;
  onConcluir: () => void;
}) {
  const scoreExibido = concluida ? inicial.scoreGeral : resultado.scoreGeral;
  const infoNivel = infoDoCodigo(
    concluida ? inicial.nivelGeral : resultado.nivelGeral
  );

  // Só faz sentido enquanto o diagnóstico está aberto: em avaliação fechada o
  // elo que importa é o do fecho, e ele vive no relatório, não nesta conta.
  const elo = concluida ? null : resultado.elo;
  const degrau = concluida ? null : resultado.proximoDegrau;
  const faltam = resultado.total - resultado.respondidos;

  // Concluir congela o score e tranca os critérios — sem volta. Passa pela
  // barreira; sem permissão, o botão desabilitado com motivo de sempre.
  const acaoDeConcluir = concluirOuSelo({
    concluida,
    podeEscrever,
    salvando,
    pronta: resultado.scoreGeral !== null,
    organizacao: inicial.organizacao,
    onConcluir,
  });

  return (
    <SectionCard
      action={acaoDeConcluir}
      subtitle={
        faltam === 0
          ? "Todos os critérios respondidos."
          : `${resultado.respondidos} de ${resultado.total} critérios respondidos. Sem os ${faltam} que faltam, não há score.`
      }
      title="Resultado"
      tone="purple"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            className="mono"
            style={{ fontSize: 38, fontWeight: 800, color: "var(--ink)" }}
          >
            {scoreExibido ?? "—"}
          </span>
          <span style={{ color: "var(--ink-faint)" }}>/ 100</span>
          {infoNivel ? (
            <Badge tone={infoNivel.tom}>{infoNivel.rotulo}</Badge>
          ) : null}
          {elo !== null && degrau !== null ? (
            <Badge tone="blue">
              {`Elo: ${INFO_DIMENSAO[elo].rotulo} → ${PORTAS[degrau].degrau} ${PORTAS[degrau].rotulo}`}
            </Badge>
          ) : null}
        </div>

        {resultado.porDimensao.map((d) => (
          <BarraDaDimensao d={d} key={d.dimensao} />
        ))}
      </div>
    </SectionCard>
  );
}

/**
 * Estado das respostas e as duas escritas que a folha faz.
 *
 * Fora do componente porque a tela já tem trabalho suficiente desenhando seis
 * cartões e dezoito critérios — e porque desfazer o otimismo é lógica que se
 * testa melhor sozinha do que dentro de JSX.
 */
function useRespostas(inicial: AvaliacaoDetalhe) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(() =>
    Object.fromEntries(
      inicial.respostas.map((r) => [
        r.criterioId,
        { nivel: r.nivel, nota: r.nota },
      ])
    )
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  // Desfaz o otimismo: deixar a tela mostrando um nível que o servidor recusou
  // é pior do que não ter clicado.
  function reverter(
    criterioId: string,
    anterior: { nivel: number; nota: string | null } | undefined
  ) {
    setEstado((s) => {
      const copia = { ...s };
      if (anterior) {
        copia[criterioId] = anterior;
      } else {
        delete copia[criterioId];
      }
      return copia;
    });
  }

  function gravar(criterioId: string, nivel: number, nota: string | null) {
    const anterior = estado[criterioId];
    setEstado((s) => ({ ...s, [criterioId]: { nivel, nota } }));
    setErro(null);
    iniciar(async () => {
      try {
        const r = await responder({
          avaliacaoId: inicial.id,
          criterioId,
          nivel,
          nota: nota ?? undefined,
        });
        if (!r.ok) {
          reverter(criterioId, anterior);
          setErro(r.error);
        }
      } catch (e) {
        setErro(mensagemDeErro(e));
      }
    });
  }

  function concluir() {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await concluirAvaliacao({ avaliacaoId: inicial.id });
        if (r.ok) {
          router.refresh();
        } else {
          setErro(r.error);
        }
      } catch (e) {
        setErro(mensagemDeErro(e));
      }
    });
  }

  return { estado, erro, salvando, gravar, concluir };
}

export function Avaliacao({
  inicial,
  podeEscrever,
}: {
  inicial: AvaliacaoDetalhe;
  podeEscrever: boolean;
}) {
  const { estado, erro, salvando, gravar, concluir } = useRespostas(inicial);

  const concluida = inicial.status === "CONCLUIDA";
  const travado = concluida || !podeEscrever;

  // A avaliação é lida com a rubrica que a carimbou, não com a em vigor: é
  // exatamente para isso que `rubricaVersao` existe. Rubrica desconhecida cai
  // na v1 e a tela avisa — melhor um score explicado do que uma tela branca.
  const rubrica = rubricaDe(inicial.rubricaVersao) ?? RUBRICA_V1;
  const rubricaDesconhecida = rubricaDe(inicial.rubricaVersao) === undefined;

  const resultado = useMemo(
    () =>
      pontuar(
        Object.entries(estado).map(([criterioId, r]) => ({
          criterioId,
          nivel: r.nivel,
        })),
        rubrica
      ),
    [estado, rubrica]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {rubricaDesconhecida ? (
        <Erro>
          {`A rubrica ${inicial.rubricaVersao} não existe nesta versão do código. Os scores abaixo foram calculados com a v1 e podem divergir do que foi entregue.`}
        </Erro>
      ) : null}

      <PainelDeResultado
        concluida={concluida}
        inicial={inicial}
        onConcluir={concluir}
        podeEscrever={podeEscrever}
        resultado={resultado}
        salvando={salvando}
      />

      {erro ? <Erro>{erro}</Erro> : null}

      {DIMENSOES.map((dimensao) => {
        const info = INFO_DIMENSAO[dimensao];
        const criterios = rubrica.criterios.filter(
          (c) => c.dimensao === dimensao
        );
        return (
          <SectionCard
            key={dimensao}
            subtitle={info.descricao}
            title={info.rotulo}
            tone={info.tom}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {criterios.map((c) => (
                <LinhaDoCriterio
                  criterio={c}
                  key={c.id}
                  onGravar={(nivel, nota) => gravar(c.id, nivel, nota)}
                  resposta={estado[c.id]}
                  travado={travado}
                />
              ))}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
