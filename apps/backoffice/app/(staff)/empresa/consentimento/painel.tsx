"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { type FocusEvent, useCallback, useState } from "react";
import {
  type ConsentimentoView,
  lerConsentimento,
  marcarParecer,
  responderPergunta,
  salvarDecisao,
} from "@/app/actions/empresa/consentimento";
import {
  BotaoPrimario,
  Campo,
  Erro,
  INPUT,
  rotuloSalvar,
} from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { WriteButton } from "@/components/write-button";

const ROTULO_BASE = {
  SEM_DECISAO: "Sem decisão",
  CONSENTIMENTO: "Consentimento — art. 7º, I",
  LEGITIMO_INTERESSE: "Legítimo interesse — art. 7º, IX",
} as const;

const ROTULO_PARECER = {
  PENDENTE: "Parecer pendente",
  ENVIADO: "Enviado ao jurídico",
  RECEBIDO: "Parecer recebido",
} as const;

type Parecer = ConsentimentoView["decisao"]["parecer"];
type PecaDoAviso = ConsentimentoView["avisos"][number]["peca"];

/** Sem ternário aninhado: cada estado é um `if`, não um segundo `?:` dentro
 *  do primeiro. */
function proximoParecerDe(parecer: Parecer): "ENVIADO" | "RECEBIDO" | null {
  if (parecer === "PENDENTE") {
    return "ENVIADO";
  }
  if (parecer === "ENVIADO") {
    return "RECEBIDO";
  }
  return null;
}

function rotuloStanding(v: boolean | null): string {
  if (v === null) {
    return "sem resposta";
  }
  return v ? "sim" : "não";
}

/** A cláusula ocupa as duas colunas; os demais avisos ficam lado a lado. */
function gridColunaDoAviso(peca: PecaDoAviso): string | undefined {
  if (peca === "CLAUSULA_PT") {
    return "1 / -1";
  }
  return;
}

/** Marcador destacado no texto: `[prazo]` em cream — o único sinal quente da
 *  tela, porque é o que não se lê em voz alta vazio. */
function Texto({ texto, abertos }: { texto: string; abertos: string[] }) {
  const partes = texto.split(/(\[[^\]]+\])/g);
  return (
    <p style={{ margin: 0, lineHeight: 1.7, fontSize: "var(--fs-base)" }}>
      {partes.map((p, i) =>
        abertos.includes(p) ? (
          <mark
            // biome-ignore lint/suspicious/noArrayIndexKey: texto estático fatiado
            key={i}
            style={{
              background: "var(--amber-soft)",
              color: "var(--amber-text)",
              borderRadius: 4,
              padding: "0 4px",
            }}
          >
            {p}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: texto estático fatiado
          <span key={i}>{p}</span>
        )
      )}
    </p>
  );
}

type BaseLegal = keyof typeof ROTULO_BASE;

/** Os chips da base legal e a barreira que grava. O clique só escolhe; o
 *  "Confirmar" grava — antes, o chip gravava na hora, e a decisão vai para a
 *  auditoria com o nome de quem clicou. Clicar na base já vigente desfaz a
 *  escolha em vez de perguntar de novo. */
function EscolhaDeBaseLegal({
  atual,
  podeEscrever,
  onDecidir,
}: {
  atual: BaseLegal;
  podeEscrever: boolean;
  onDecidir: (baseLegal: BaseLegal) => Promise<void>;
}) {
  const [escolhida, setEscolhida] = useState<BaseLegal | null>(null);

  function escolher(b: BaseLegal) {
    if (b === atual) {
      setEscolhida(null);
      return;
    }
    setEscolhida(b);
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {(Object.keys(ROTULO_BASE) as BaseLegal[]).map((b) => (
          <button
            aria-pressed={atual === b}
            className="btn"
            disabled={!podeEscrever}
            key={b}
            onClick={() => escolher(b)}
            style={{
              padding: "6px 12px",
              borderRadius: 99,
              border: `1px solid ${
                atual === b ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"
              }`,
              background:
                atual === b ? "var(--accent-soft)" : "var(--surface-2)",
              fontSize: "var(--fs-nota)",
              fontWeight: 700,
              cursor: "pointer",
            }}
            type="button"
          >
            {ROTULO_BASE[b]}
          </button>
        ))}
      </div>
      {escolhida ? (
        <div style={{ marginBottom: 12 }}>
          <ConfirmarAcao
            aberto
            alvo={ROTULO_BASE[escolhida]}
            consequencia="A base legal fica registrada na auditoria com seu nome."
            onConfirmar={async () => {
              await onDecidir(escolhida);
              setEscolhida(null);
            }}
            onVoltar={() => setEscolhida(null)}
            rotulo="Registrar base legal"
            tom="accent"
          />
        </div>
      ) : null}
    </>
  );
}

export function Painel({
  inicial,
  podeEscrever,
}: {
  inicial: ConsentimentoView;
  podeEscrever: boolean;
}) {
  const [view, setView] = useState(inicial);
  const [form, setForm] = useState({
    ferramenta: inicial.decisao.ferramenta ?? "",
    prazoRetencao: inicial.decisao.prazoRetencao ?? "",
    contatoTitular: inicial.decisao.contatoTitular ?? "",
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sujo =
    form.ferramenta !== (view.decisao.ferramenta ?? "") ||
    form.prazoRetencao !== (view.decisao.prazoRetencao ?? "") ||
    form.contatoTitular !== (view.decisao.contatoTitular ?? "");

  const recarregar = useCallback(async () => {
    const res = await lerConsentimento();
    if (res.ok) {
      setView(res.data);
    }
  }, []);

  const salvarMarcadores = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    const res = await salvarDecisao({
      ferramenta: form.ferramenta.trim() || null,
      prazoRetencao: form.prazoRetencao.trim() || null,
      contatoTitular: form.contatoTitular.trim() || null,
    });
    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    await recarregar();
    setForm({
      ferramenta: form.ferramenta.trim() || "",
      prazoRetencao: form.prazoRetencao.trim() || "",
      contatoTitular: form.contatoTitular.trim() || "",
    });
  }, [form, recarregar]);

  const decidir = useCallback(
    async (patch: Parameters<typeof salvarDecisao>[0]) => {
      setErro(null);
      const res = await salvarDecisao(patch);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
    },
    [recarregar]
  );

  const responder = useCallback(
    async (numero: number, resposta: string) => {
      setErro(null);
      const res = await responderPergunta({
        numero,
        resposta: resposta.trim() || null,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
    },
    [recarregar]
  );

  const parecer = useCallback(
    async (status: "ENVIADO" | "RECEBIDO") => {
      setErro(null);
      const res = await marcarParecer({ status });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
    },
    [recarregar]
  );

  const responderSeMudou = useCallback(
    (p: ConsentimentoView["perguntas"][number]) =>
      (e: FocusEvent<HTMLTextAreaElement>) => {
        if (!podeEscrever) {
          return;
        }
        if (e.target.value === (p.resposta ?? "")) {
          return;
        }
        responder(p.numero, e.target.value);
      },
    [podeEscrever, responder]
  );

  const proximoParecer = proximoParecerDe(view.decisao.parecer);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Badge tone={view.decisao.parecer === "RECEBIDO" ? "green" : "blue"}>
          {ROTULO_PARECER[view.decisao.parecer]}
        </Badge>
        {proximoParecer ? (
          <WriteButton
            canWrite={podeEscrever}
            onClick={() => parecer(proximoParecer)}
            type="button"
          >
            {proximoParecer === "ENVIADO"
              ? "Enviar ao jurídico"
              : "Marcar parecer recebido"}
          </WriteButton>
        ) : null}
      </div>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        subtitle={`${view.camposEmAberto.length} campos em aberto${
          view.camposEmAberto.length
            ? `: ${view.camposEmAberto.join(" · ")}`
            : ""
        }`}
        title="Aviso lido na abertura"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Campo htmlFor="ferramenta" label="[ferramenta]">
            <input
              id="ferramenta"
              onChange={(e) => setForm({ ...form, ferramenta: e.target.value })}
              readOnly={!podeEscrever}
              style={INPUT}
              value={form.ferramenta}
            />
          </Campo>
          <Campo hint="Pergunta 6 do parecer" htmlFor="prazo" label="[prazo]">
            <input
              id="prazo"
              onChange={(e) =>
                setForm({ ...form, prazoRetencao: e.target.value })
              }
              readOnly={!podeEscrever}
              style={INPUT}
              value={form.prazoRetencao}
            />
          </Campo>
          <Campo htmlFor="contato" label="[contato]">
            <input
              id="contato"
              onChange={(e) =>
                setForm({ ...form, contatoTitular: e.target.value })
              }
              readOnly={!podeEscrever}
              style={INPUT}
              value={form.contatoTitular}
            />
          </Campo>
        </div>
        {podeEscrever ? (
          <BotaoPrimario
            disabled={!sujo || salvando}
            full={false}
            onClick={salvarMarcadores}
            type="button"
          >
            {rotuloSalvar(salvando, sujo)}
          </BotaoPrimario>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 16,
          }}
        >
          {view.avisos.map((a) => (
            <div
              key={a.peca}
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: "var(--r-md)",
                padding: 14,
                gridColumn: gridColunaDoAviso(a.peca),
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <strong style={{ fontSize: "var(--fs-base)" }}>
                  {a.titulo}
                </strong>
                <button
                  className="btn"
                  onClick={() => navigator.clipboard.writeText(a.texto)}
                  style={{
                    background: "none",
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--r-sm)",
                    padding: "2px 8px",
                    fontSize: "var(--fs-nota)",
                    cursor: "pointer",
                    color: "var(--ink-muted)",
                  }}
                  type="button"
                >
                  Copiar
                </button>
              </div>
              {a.nota ? (
                <div
                  style={{
                    fontSize: "var(--fs-nota)",
                    color: "var(--ink-faint)",
                    marginBottom: 8,
                  }}
                >
                  {a.nota}
                </div>
              ) : null}
              <Texto abertos={a.abertos} texto={a.texto} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        subtitle="A escolha é do responsável jurídico. Até lá, nenhum tenant habilita o consentimento permanente."
        title="Base legal"
      >
        <EscolhaDeBaseLegal
          atual={view.decisao.baseLegal}
          onDecidir={(baseLegal) => decidir({ baseLegal })}
          podeEscrever={podeEscrever}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--fs-base)",
          }}
        >
          <input
            checked={view.decisao.standingHabilitavel === true}
            disabled={!podeEscrever}
            onChange={(e) => decidir({ standingHabilitavel: e.target.checked })}
            type="checkbox"
          />
          STANDING habilitável (pergunta 4) —{" "}
          {rotuloStanding(view.decisao.standingHabilitavel)}
        </label>
      </SectionCard>

      <SectionCard
        subtitle={`${view.abertas} abertas · ${
          view.perguntas.length - view.abertas
        } respondidas`}
        title="Perguntas ao parecer"
      >
        <ol
          style={{
            margin: 0,
            paddingLeft: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {view.perguntas.map((p) => (
            <li key={p.numero} style={{ fontSize: "var(--fs-base)" }}>
              <div style={{ marginBottom: 6 }}>
                {p.pergunta}{" "}
                <span
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: "var(--fs-nota)",
                  }}
                >
                  · {p.donoPapel}
                </span>
              </div>
              <textarea
                aria-label={`Resposta à pergunta ${p.numero}`}
                defaultValue={p.resposta ?? ""}
                key={`${p.numero}:${p.resposta ?? ""}`}
                onBlur={responderSeMudou(p)}
                readOnly={!podeEscrever}
                rows={2}
                style={{ ...INPUT, fontWeight: 500 }}
              />
            </li>
          ))}
        </ol>
      </SectionCard>
    </>
  );
}
