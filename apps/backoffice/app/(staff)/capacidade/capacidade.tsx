"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  allocatePersonAction,
  createPersonAction,
  type PessoaCapacidade,
} from "@/app/actions/capacity";
import type { EngagementRow } from "@/app/actions/engagements";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";

/**
 * Capacidade por pessoa.
 *
 * A barra é a leitura principal: a pergunta que abre esta tela é "quem tem
 * espaço", e responder isso lendo doze percentuais em texto é trabalho que a
 * barra faz de relance.
 */

const VIRGULA = /\s*,\s*/;

function tomDaOcupacao(pct: number): Tone {
  if (pct > 100) {
    return "red";
  }
  if (pct >= 85) {
    return "amber";
  }
  if (pct === 0) {
    return "neutral";
  }
  return "green";
}

function BarraDeOcupacao({ pct }: { pct: number }) {
  return (
    <span
      style={{
        display: "block",
        height: 6,
        borderRadius: 99,
        background: "var(--surface-3)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          // Acima de 100% a barra enche e a cor muda — esticar além da caixa
          // esconderia o excesso justamente onde ele importa.
          width: `${Math.min(pct, 100)}%`,
          height: "100%",
          background: `var(--${tomDaOcupacao(pct)})`,
        }}
      />
    </span>
  );
}

function Pessoa({
  p,
  primeira,
  podeEscrever,
  onAlocar,
}: {
  p: PessoaCapacidade;
  primeira: boolean;
  podeEscrever: boolean;
  onAlocar: (id: string) => void;
}) {
  return (
    <li
      style={{
        padding: "13px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        opacity: p.ativo ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--fs-base)",
              fontWeight: 600,
            }}
          >
            {p.nome}
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {p.email} · {p.horasSemana}h/semana
          </span>
        </span>
        {p.habilidades.map((h) => (
          <Badge key={h} tone="neutral">
            {h}
          </Badge>
        ))}
        <Badge dot tone={tomDaOcupacao(p.ocupacaoAtual)}>
          {p.ocupacaoAtual}%
        </Badge>
        {podeEscrever ? (
          <button
            className="btn"
            onClick={() => onAlocar(p.id)}
            style={{
              padding: "4px 10px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--hairline)",
              background: "none",
              color: "var(--ink-muted)",
              fontSize: "var(--fs-nota)",
              fontWeight: 600,
              cursor: "pointer",
            }}
            type="button"
          >
            Alocar
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 8 }}>
        <BarraDeOcupacao pct={p.ocupacaoAtual} />
      </div>

      {p.alocacoes.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
          }}
        >
          {p.alocacoes.map((a) => (
            <span
              className="mono"
              key={`${a.engajamento}-${a.inicioEm}`}
              style={{
                fontSize: "var(--fs-micro)",
                padding: "2px 7px",
                borderRadius: "var(--r-pill)",
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
                color: "var(--ink-faint)",
              }}
            >
              {a.percentual}% · {a.engajamento}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function Capacidade({
  iniciais,
  engajamentos,
  podeEscrever,
}: {
  iniciais: PessoaCapacidade[];
  engajamentos: EngagementRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [erro, setErro] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  const [pessoa, setPessoa] = useState({
    nome: "",
    email: "",
    habilidades: "",
    horas: "40",
  });
  const [alocando, setAlocando] = useState<string | null>(null);
  const [aloc, setAloc] = useState({
    engagementId: "",
    percentual: "50",
    inicioEm: "",
    fimEm: "",
    motivo: "",
  });

  const cadastrar = useCallback(async () => {
    setErro(null);
    const res = await createPersonAction({
      nome: pessoa.nome,
      email: pessoa.email,
      habilidades: pessoa.habilidades
        .split(VIRGULA)
        .map((h) => h.trim())
        .filter(Boolean),
      horasSemana: Number(pessoa.horas) || 40,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setLista((atual) => [
      ...atual,
      {
        id: res.data.id,
        nome: pessoa.nome,
        email: pessoa.email,
        habilidades: pessoa.habilidades
          .split(VIRGULA)
          .map((h) => h.trim())
          .filter(Boolean),
        horasSemana: Number(pessoa.horas) || 40,
        ativo: true,
        ocupacaoAtual: 0,
        alocacoes: [],
      },
    ]);
    setNova(false);
    setPessoa({ nome: "", email: "", habilidades: "", horas: "40" });
  }, [pessoa]);

  const alocar = useCallback(async () => {
    if (!alocando) {
      return;
    }
    setErro(null);
    const res = await allocatePersonAction({
      personId: alocando,
      engagementId: aloc.engagementId,
      percentual: Number(aloc.percentual) || 0,
      inicioEm: aloc.inicioEm,
      fimEm: aloc.fimEm || undefined,
      motivoExcesso: aloc.motivo || undefined,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    // Recarrega para a ocupação vir recalculada pelo servidor. Somar aqui
    // duplicaria a regra de sobreposição de períodos, e duas cópias divergem.
    window.location.reload();
  }, [alocando, aloc]);

  const sobrecarregados = lista.filter((p) => p.ocupacaoAtual > 100).length;
  // Fora do JSX: o `&&` inline vira valor vazando para o render aos olhos do
  // lint, e nomear a condição diz o que ela significa.
  const podeAlocar = Boolean(aloc.engagementId && aloc.inicioEm);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      {alocando ? (
        <SectionCard icon="users" title="Nova alocação">
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            }}
          >
            <Campo htmlFor="a-eng" label="Engajamento">
              <select
                id="a-eng"
                onChange={(e) =>
                  setAloc((a) => ({ ...a, engagementId: e.target.value }))
                }
                style={{ ...INPUT, cursor: "pointer" }}
                value={aloc.engagementId}
              >
                <option value="">Escolha…</option>
                {engajamentos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {e.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo htmlFor="a-pct" label="Percentual">
              <input
                id="a-pct"
                max={100}
                min={1}
                onChange={(e) =>
                  setAloc((a) => ({ ...a, percentual: e.target.value }))
                }
                style={INPUT}
                type="number"
                value={aloc.percentual}
              />
            </Campo>
            <Campo htmlFor="a-ini" label="Início">
              <input
                id="a-ini"
                onChange={(e) =>
                  setAloc((a) => ({ ...a, inicioEm: e.target.value }))
                }
                style={INPUT}
                type="date"
                value={aloc.inicioEm}
              />
            </Campo>
            <Campo htmlFor="a-fim" label="Fim (opcional)">
              <input
                id="a-fim"
                onChange={(e) =>
                  setAloc((a) => ({ ...a, fimEm: e.target.value }))
                }
                style={INPUT}
                type="date"
                value={aloc.fimEm}
              />
            </Campo>
          </div>

          <div style={{ marginTop: 10 }}>
            <Campo
              hint="só é exigido se a soma no período passar de 100%"
              htmlFor="a-motivo"
              label="Motivo da sobrecarga"
            >
              <input
                id="a-motivo"
                onChange={(e) =>
                  setAloc((a) => ({ ...a, motivo: e.target.value }))
                }
                placeholder="ex.: cobertura de férias por duas semanas"
                style={INPUT}
                value={aloc.motivo}
              />
            </Campo>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <BotaoPrimario
              disabled={!podeAlocar}
              full={false}
              onClick={alocar}
              type="button"
            >
              Alocar
            </BotaoPrimario>
            <button
              className="btn"
              onClick={() => setAlocando(null)}
              style={{
                padding: "9px 15px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "none",
                color: "var(--ink-muted)",
                fontSize: "var(--fs-base)",
                fontWeight: 600,
                cursor: "pointer",
              }}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        action={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setNova((v) => !v)}
              type="button"
            >
              {nova ? "Cancelar" : "Nova pessoa"}
            </BotaoPrimario>
          ) : null
        }
        icon="users"
        subtitle={
          sobrecarregados > 0
            ? `${lista.length} pessoa(s) · ${sobrecarregados} acima de 100%`
            : `${lista.length} pessoa(s)`
        }
        title="Equipe"
      >
        {nova ? (
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              paddingBottom: 14,
              marginBottom: 14,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <Campo htmlFor="p-nome" label="Nome">
              <input
                id="p-nome"
                onChange={(e) =>
                  setPessoa((p) => ({ ...p, nome: e.target.value }))
                }
                style={INPUT}
                value={pessoa.nome}
              />
            </Campo>
            <Campo htmlFor="p-email" label="E-mail">
              <input
                id="p-email"
                onChange={(e) =>
                  setPessoa((p) => ({ ...p, email: e.target.value }))
                }
                style={INPUT}
                type="email"
                value={pessoa.email}
              />
            </Campo>
            <Campo
              hint="separadas por vírgula — quase todo mundo faz mais de uma"
              htmlFor="p-hab"
              label="Habilidades"
            >
              <input
                id="p-hab"
                onChange={(e) =>
                  setPessoa((p) => ({ ...p, habilidades: e.target.value }))
                }
                placeholder="frontend, backend, dados"
                style={INPUT}
                value={pessoa.habilidades}
              />
            </Campo>
            <Campo htmlFor="p-horas" label="Horas/semana">
              <input
                id="p-horas"
                onChange={(e) =>
                  setPessoa((p) => ({ ...p, horas: e.target.value }))
                }
                style={INPUT}
                type="number"
                value={pessoa.horas}
              />
            </Campo>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <BotaoPrimario
                disabled={
                  pessoa.nome.trim().length < 2 || !pessoa.email.includes("@")
                }
                onClick={cadastrar}
                type="button"
              >
                Cadastrar
              </BotaoPrimario>
            </div>
          </div>
        ) : null}

        {lista.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 28,
              textAlign: "center",
              fontSize: "var(--fs-base)",
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            Nenhuma pessoa cadastrada. Sem equipe registrada não dá para
            responder se um engajamento novo cabe.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lista.map((p, i) => (
              <Pessoa
                key={p.id}
                onAlocar={setAlocando}
                p={p}
                podeEscrever={podeEscrever}
                primeira={i === 0}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
