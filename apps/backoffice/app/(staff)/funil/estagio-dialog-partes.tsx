"use client";

import { KpiCard, type Tone } from "@repo/design-system/cosmos/kit";
import type { MudancaRow } from "@/app/actions/funil-config";
import type { LeadRow } from "@/app/actions/leads";
import {
  BotaoPrimario,
  BotaoSecundario,
  Campo,
  Erro,
  INPUT,
} from "@/components/campo";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  type ConfigEstagio,
  diasNoEstagio,
  paraLeadFunil,
  SEM_PROXIMO_PASSO,
  valorDoLead,
} from "@/lib/comercial/funil";
import { formatarData } from "@/lib/data";
import { tomCss } from "@/lib/tom";

/**
 * Peças do painel do estágio — extraídas de estagio-dialog.tsx pelo mesmo
 * motivo de lead-dialog-partes.tsx: o arquivo principal fica só com o
 * carregamento de dados e a composição (spec §4, design
 * backoffice-funnel-stage.jsx).
 */

const ROTULO_CAMPO: Record<string, string> = {
  PESO: "Peso",
  TETO: "Teto",
  CRITERIOS: "Critérios de saída",
};

function Rotulo({ children, tone }: { children: string; tone?: Tone }) {
  return (
    <span
      className="mono"
      style={{
        display: "block",
        fontSize: "var(--fs-nota)",
        fontWeight: 700,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        color: tone ? `var(--${tomCss(tone)}-text)` : "var(--ink-faint)",
      }}
    >
      {children}
    </span>
  );
}

function textoProximoPasso(l: LeadRow): string {
  if (l.proximaAcao) {
    const data = l.proximaAcaoEm ? ` · ${formatarData(l.proximaAcaoEm)}` : "";
    return `${l.proximaAcao}${data}`;
  }
  if (l.proposta) {
    return `lê ${l.proposta.numero}`;
  }
  return SEM_PROXIMO_PASSO;
}

function infoPermanencia(
  permanenciaMediaDias: number | null,
  tetoDias: number
): { hint: string; tone: Tone } {
  if (permanenciaMediaDias === null) {
    return { hint: "—", tone: "neutral" };
  }
  const acima = permanenciaMediaDias > tetoDias;
  return {
    hint: acima
      ? `acima do teto de ${tetoDias} d`
      : `dentro do teto de ${tetoDias} d`,
    tone: acima ? "red" : "neutral",
  };
}

function contarEstagnados(
  leads: LeadRow[],
  tetoDias: number,
  hoje: Date
): { qtd: number; piorDias: number } {
  let qtd = 0;
  let piorDias = 0;
  for (const l of leads) {
    const dias = diasNoEstagio(l.estagioDesde, hoje);
    if (dias > tetoDias) {
      qtd += 1;
      if (dias > piorDias) {
        piorDias = dias;
      }
    }
  }
  return { piorDias, qtd };
}

/** Os 4 cartões: agora, conversão 90 d, permanência média, estagnados. */
export function CartoesEstagio({
  leads,
  cfg,
  hoje,
  metricas,
  tone,
}: {
  leads: LeadRow[];
  cfg: ConfigEstagio;
  hoje: Date;
  metricas: {
    entraram: number;
    avancaram: number;
    perdidos: number;
    permanenciaMediaDias: number | null;
  };
  tone: Tone;
}) {
  const valorAgora = leads.reduce(
    (soma, l) => soma + valorDoLead(paraLeadFunil(l)),
    0
  );
  const ponderado = Math.round((valorAgora * cfg.pesoPercent) / 100);
  // PROPOSAL ainda não tem GANHO no histórico — "avançar" a partir dali é a
  // proposta virar cliente, e isso não é uma transição de HistoricoDeEstagio
  // que `metricasDoEstagio` enxergue. Mostrar 0% seria dizer que nada avança,
  // o que não é verdade — é "—", não medido.
  const temConversaoMedida = cfg.codigo !== "PROPOSAL";
  const unidadeConversao = temConversaoMedida ? "%" : undefined;
  const conversaoPercent =
    metricas.entraram === 0
      ? 0
      : Math.round((metricas.avancaram / metricas.entraram) * 100);
  const permanencia = infoPermanencia(
    metricas.permanenciaMediaDias,
    cfg.tetoDias
  );
  const estagnados = contarEstagnados(leads, cfg.tetoDias, hoje);

  return (
    <div className="bo-kpis" style={{ gap: 10 }}>
      <KpiCard
        hint={`${formatarBRL(valorAgora)} · ponderado ${formatarBRL(ponderado)}`}
        icon="wallet"
        label="Agora"
        tone={tone}
        value={leads.length}
      />
      <KpiCard
        hint={
          temConversaoMedida
            ? `${metricas.avancaram} de ${metricas.entraram} avançaram · ${metricas.perdidos} perdidos`
            : "sem GANHO no histórico ainda"
        }
        icon="trendingUp"
        label="Conversão 90 d"
        tone="green"
        unit={unidadeConversao}
        value={temConversaoMedida ? conversaoPercent : "—"}
      />
      <KpiCard
        hint={permanencia.hint}
        icon="clock"
        label="Permanência média"
        tone={permanencia.tone}
        unit={metricas.permanenciaMediaDias === null ? undefined : "d"}
        value={
          metricas.permanenciaMediaDias === null
            ? "—"
            : metricas.permanenciaMediaDias
        }
      />
      <KpiCard
        hint={
          estagnados.qtd > 0
            ? `pior: ${estagnados.piorDias} d`
            : "ninguém acima do teto"
        }
        icon="alert"
        label="Estagnados"
        tone={estagnados.qtd > 0 ? "red" : "neutral"}
        value={estagnados.qtd}
      />
    </div>
  );
}

/** Critério de saída, só leitura — a edição mora em `EditorDeEstagio`. */
export function CriteriosDeSaida({
  criterios,
  tone,
}: {
  criterios: string[];
  tone: Tone;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
      }}
    >
      <Rotulo tone={tone}>
        Critério de saída — o que precisa ser verdade para avançar
      </Rotulo>
      {criterios.length === 0 ? (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "var(--fs-base)",
            color: "var(--ink-faint)",
          }}
        >
          Nenhum critério registrado.
        </p>
      ) : (
        <ul
          style={{
            margin: "10px 0 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {criterios.map((c) => (
            <li
              key={c}
              style={{
                display: "flex",
                gap: 9,
                fontSize: "var(--fs-base)",
                lineHeight: 1.5,
              }}
            >
              <span
                aria-hidden
                className="mono"
                style={{
                  fontSize: "var(--fs-nota)",
                  color: `var(--${tomCss(tone)}-text)`,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ☐
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Leads do estágio, ordenados por tempo (o pai já ordena e filtra ATIVO). */
export function ListaLeadsPorTempo({
  leads,
  cfg,
  hoje,
  onAbrirLead,
}: {
  leads: LeadRow[];
  cfg: ConfigEstagio;
  hoje: Date;
  onAbrirLead: (id: string) => void;
}) {
  return (
    <div
      style={{
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "9px 12px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--hairline)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Rotulo>Leads neste estágio · por tempo</Rotulo>
        <Rotulo>{String(leads.length)}</Rotulo>
      </div>
      {leads.length === 0 ? (
        <div
          style={{
            padding: 16,
            fontSize: "var(--fs-base)",
            color: "var(--ink-faint)",
          }}
        >
          Nenhum lead aqui agora.
        </div>
      ) : (
        leads.map((l, i) => {
          const dias = diasNoEstagio(l.estagioDesde, hoje);
          const vencido = dias > cfg.tetoDias;
          const valor = valorDoLead(paraLeadFunil(l));
          return (
            <button
              aria-label={`Abrir lead ${l.nome}`}
              className="btn"
              key={l.id}
              onClick={() => onAbrirLead(l.id)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom:
                  i < leads.length - 1 ? "1px solid var(--hairline)" : "none",
                padding: "9px 12px",
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto auto",
                gap: 10,
                alignItems: "center",
                color: "var(--ink)",
                cursor: "pointer",
              }}
              type="button"
            >
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--fs-base)",
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.nome}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "var(--fs-nota)",
                    color: vencido ? "var(--red-text)" : "var(--ink-faint)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {textoProximoPasso(l)}
                </span>
              </span>
              <span
                className="mono"
                style={{
                  fontSize: "var(--fs-nota)",
                  fontWeight: 700,
                  color: "var(--amber-text)",
                }}
              >
                {valor > 0 ? formatarBRL(valor) : "—"}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: "var(--fs-nota)",
                  fontWeight: 800,
                  minWidth: 34,
                  textAlign: "right",
                  color: vencido ? "var(--red-text)" : "var(--ink-muted)",
                }}
              >
                {dias} d
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function CorpoRegistro({
  mudancas,
  carregando,
}: {
  mudancas: MudancaRow[] | null;
  carregando: boolean;
}) {
  if (carregando) {
    return (
      <p
        style={{
          fontSize: "var(--fs-base)",
          color: "var(--ink-faint)",
          marginTop: 6,
        }}
      >
        Carregando…
      </p>
    );
  }
  if (!mudancas || mudancas.length === 0) {
    return (
      <p
        style={{
          fontSize: "var(--fs-base)",
          color: "var(--ink-faint)",
          marginTop: 6,
        }}
      >
        Configuração de origem, nunca alterada.
      </p>
    );
  }
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}
    >
      {mudancas.map((m) => (
        <div
          key={m.id}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gap: 10,
            fontSize: "var(--fs-base)",
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--surface-2)",
            border: "1px solid var(--hairline)",
            alignItems: "baseline",
          }}
        >
          <span>
            <span className="mono" style={{ fontWeight: 700 }}>
              {ROTULO_CAMPO[m.campo] ?? m.campo}
            </span>{" "}
            <span className="mono" style={{ color: "var(--ink-muted)" }}>
              {m.de} → {m.para}
            </span>
            <div style={{ color: "var(--ink-muted)", marginTop: 3 }}>
              {m.motivo}
            </div>
          </span>
          <span
            className="mono"
            style={{
              fontSize: "var(--fs-nota)",
              color: "var(--ink-faint)",
              whiteSpace: "nowrap",
            }}
          >
            {m.autorNome ? `${m.autorNome} · ` : ""}
            {formatarData(m.criadoEm)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Registro de mudanças do estágio, append-only (spec §1.2). */
export function RegistroDeMudancas({
  mudancas,
  carregando,
}: {
  mudancas: MudancaRow[] | null;
  carregando: boolean;
}) {
  return (
    <div>
      <Rotulo>Registro de mudanças do estágio · append-only</Rotulo>
      <CorpoRegistro carregando={carregando} mudancas={mudancas} />
    </div>
  );
}

/** Formulário de edição — peso, teto, critérios e motivo (ADMIN). Estado
 *  controlado pelo pai (mesmo padrão de `ModoPerda` em lead-dialog-partes),
 *  para o pai decidir "mudou?" comparando contra a configuração carregada. */
export function EditorDeEstagio({
  peso,
  teto,
  criteriosTexto,
  motivo,
  pendente,
  podeRegistrar,
  erro,
  onPeso,
  onTeto,
  onCriteriosTexto,
  onMotivo,
  onCancelar,
  onSalvar,
}: {
  peso: number;
  teto: number;
  criteriosTexto: string;
  motivo: string;
  pendente: boolean;
  podeRegistrar: boolean;
  erro: string | null;
  onPeso: (v: number) => void;
  onTeto: (v: number) => void;
  onCriteriosTexto: (v: string) => void;
  onMotivo: (v: string) => void;
  onCancelar: () => void;
  onSalvar: () => void;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Rotulo>Editar estágio</Rotulo>
      {erro ? <Erro>{erro}</Erro> : null}
      <Campo
        hint="Um critério por linha."
        htmlFor="ee-criterios"
        label="Critérios de saída"
      >
        <textarea
          id="ee-criterios"
          onChange={(e) => onCriteriosTexto(e.target.value)}
          rows={4}
          style={{ ...INPUT, resize: "vertical", fontSize: "var(--fs-base)" }}
          value={criteriosTexto}
        />
      </Campo>
      <div className="bo-duas-colunas">
        <Campo
          hint="Multiplica o valor no pipeline ponderado."
          htmlFor="ee-peso"
          label="Peso (%)"
        >
          <input
            id="ee-peso"
            max={100}
            min={0}
            onChange={(e) => onPeso(Number(e.target.value))}
            step={5}
            style={INPUT}
            type="number"
            value={peso}
          />
        </Campo>
        <Campo
          hint="Acima disso o lead é estagnado."
          htmlFor="ee-teto"
          label="Teto (dias)"
        >
          <input
            id="ee-teto"
            min={1}
            onChange={(e) => onTeto(Number(e.target.value))}
            step={1}
            style={INPUT}
            type="number"
            value={teto}
          />
        </Campo>
      </div>
      <Campo
        hint={`${motivo.trim().length}/20 · vai para o registro com seu nome`}
        htmlFor="ee-motivo"
        label="Por que muda"
      >
        <textarea
          id="ee-motivo"
          onChange={(e) => onMotivo(e.target.value)}
          placeholder="Leads com capacidade simulada fecham em 3 de 5; o peso antigo subestimava o pipeline."
          rows={2}
          style={{ ...INPUT, resize: "vertical" }}
          value={motivo}
        />
      </Campo>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BotaoSecundario disabled={pendente} onClick={onCancelar}>
          Cancelar
        </BotaoSecundario>
        <BotaoPrimario
          disabled={!podeRegistrar}
          full={false}
          onClick={onSalvar}
          type="button"
        >
          {pendente ? "Registrando…" : "Registrar mudança"}
        </BotaoPrimario>
      </div>
    </div>
  );
}
