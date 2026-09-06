"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AvaliacaoRow } from "@/app/actions/maturidade";
import { criarAvaliacao } from "@/app/actions/maturidade";
import { Campo, Erro, INPUT, mensagemDeErro } from "@/components/campo";
import { WriteButton } from "@/components/write-button";
import { CODIGOS_NIVEL, INFO_NIVEL, type Nivel } from "@/lib/growth/maturidade";

const CABECALHO = {
  padding: "0 10px 7px",
  textAlign: "left" as const,
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase" as const,
  color: "var(--ink-faint)",
};

const CELULA = {
  padding: "9px 10px",
  borderTop: "1px solid var(--hairline)",
  fontSize: "var(--fs-base)",
};

/** Tom do nível a partir do código gravado na avaliação.
 *
 *  Lê do código e não do score porque é o código que foi congelado no fecho: a
 *  faixa pode mudar de corte numa rubrica futura, o rótulo que o cliente viu
 *  não muda. */
function tomDoNivel(codigo: string | null) {
  const nivel = CODIGOS_NIVEL.indexOf(codigo as (typeof CODIGOS_NIVEL)[number]);
  return nivel === -1 ? undefined : INFO_NIVEL[nivel as Nivel];
}

function NovaAvaliacao({ podeEscrever }: { podeEscrever: boolean }) {
  const router = useRouter();
  const [organizacao, setOrganizacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const nome = organizacao.trim();

  function enviar() {
    setErro(null);
    iniciar(async () => {
      try {
        const r = await criarAvaliacao({ organizacao: nome });
        if (r.ok) {
          // Vai direto para a folha de respostas: criar e cair numa lista faz
          // a pessoa procurar o que ela acabou de criar.
          router.push(`/growth/readiness/${r.data.id}`);
        } else {
          setErro(r.error);
        }
      } catch (e) {
        setErro(mensagemDeErro(e));
      }
    });
  }

  return (
    <SectionCard
      subtitle="A organização não precisa ser cliente — o diagnóstico é o que se faz antes."
      title="Nova avaliação"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
      >
        <div style={{ flex: 1 }}>
          <Campo htmlFor="organizacao" label="Organização">
            <input
              id="organizacao"
              maxLength={160}
              onChange={(e) => setOrganizacao(e.target.value)}
              placeholder="Nome da organização avaliada"
              style={INPUT}
              value={organizacao}
            />
          </Campo>
        </div>
        <WriteButton
          canWrite={podeEscrever}
          disabled={enviando || nome.length < 2}
          onClick={enviar}
        >
          {enviando ? "Criando…" : "Criar e responder"}
        </WriteButton>
      </form>
      {erro ? <Erro>{erro}</Erro> : null}
    </SectionCard>
  );
}

export function Lista({
  avaliacoes,
  podeEscrever,
  totalDeCriterios,
}: {
  avaliacoes: AvaliacaoRow[];
  podeEscrever: boolean;
  totalDeCriterios: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <NovaAvaliacao podeEscrever={podeEscrever} />

      <SectionCard
        subtitle={`${totalDeCriterios} critérios por avaliação. Score só sai com todos respondidos.`}
        title="Avaliações"
      >
        {avaliacoes.length === 0 ? (
          <p
            style={{
              color: "var(--ink-faint)",
              fontSize: "var(--fs-base)",
              margin: 0,
            }}
          >
            Nenhuma avaliação ainda.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={CABECALHO}>Organização</th>
                <th style={CABECALHO}>Situação</th>
                <th style={CABECALHO}>Score</th>
                <th style={CABECALHO}>Nível</th>
                <th style={CABECALHO}>Rubrica</th>
                <th style={CABECALHO}>Autor</th>
              </tr>
            </thead>
            <tbody>
              {avaliacoes.map((a) => {
                const info = tomDoNivel(a.nivelGeral);
                return (
                  <tr key={a.id}>
                    <td style={CELULA}>
                      <Link
                        href={`/growth/readiness/${a.id}`}
                        style={{ color: "var(--ink)", fontWeight: 600 }}
                      >
                        {a.organizacao}
                      </Link>
                      {a.leadNome ? (
                        <span
                          style={{
                            color: "var(--ink-faint)",
                            fontSize: "var(--fs-nota)",
                            marginLeft: 8,
                          }}
                        >
                          via funil · {a.leadNome}
                        </span>
                      ) : null}
                    </td>
                    <td style={CELULA}>
                      {a.status === "CONCLUIDA" ? (
                        <Badge tone="green">Concluída</Badge>
                      ) : (
                        <Badge tone="amber">
                          Rascunho · {a.respondidos}/{totalDeCriterios}
                        </Badge>
                      )}
                    </td>
                    <td style={CELULA}>{a.scoreGeral ?? "—"}</td>
                    <td style={CELULA}>
                      {info ? (
                        <Badge tone={info.tom}>{info.rotulo}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ ...CELULA, color: "var(--ink-faint)" }}>
                      {a.rubricaVersao}
                    </td>
                    <td style={{ ...CELULA, color: "var(--ink-muted)" }}>
                      {a.autorNome ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
