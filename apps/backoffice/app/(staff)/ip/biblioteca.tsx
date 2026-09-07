"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import type { EngagementRow } from "@/app/actions/engagements";
import {
  createIpAssetAction,
  getIpAsset,
  type IpAssetDetail,
  type IpAssetRow,
  updateIpAssetAction,
} from "@/app/actions/ip-library";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { SeletorDeAcervo } from "@/components/seletor-de-acervo";

const TIPOS = [
  { valor: "PLAYBOOK", rotulo: "Playbook" },
  { valor: "TEMPLATE", rotulo: "Template" },
  { valor: "COMPONENTE", rotulo: "Componente" },
  { valor: "DOCUMENTO", rotulo: "Documento" },
];

export function Biblioteca({
  iniciais,
  engajamentos,
  podeEscrever,
}: {
  iniciais: IpAssetRow[];
  engajamentos: EngagementRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [aberto, setAberto] = useState<IpAssetDetail | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [nota, setNota] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    tipo: "PLAYBOOK",
    descricao: "",
    origem: "",
  });

  const abrir = useCallback(async (id: string) => {
    setErro(null);
    const res = await getIpAsset(id);
    if (res.ok) {
      setAberto(res.data);
      setRascunho(res.data.conteudo);
      setNota("");
    } else {
      setErro(res.error);
    }
  }, []);

  const criar = useCallback(async () => {
    setErro(null);
    const res = await createIpAssetAction({
      nome: form.nome,
      tipo: form.tipo as "PLAYBOOK",
      descricao: form.descricao || undefined,
      origemEngagementId: form.origem || undefined,
      conteudo: `# ${form.nome}\n\n`,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setCriando(false);
    setForm({ nome: "", tipo: "PLAYBOOK", descricao: "", origem: "" });
    const det = await getIpAsset(res.data.id);
    if (det.ok) {
      setAberto(det.data);
      setRascunho(det.data.conteudo);
      setLista((atual) => [
        {
          id: det.data.id,
          nome: det.data.nome,
          slug: det.data.slug,
          tipo: det.data.tipo,
          descricao: det.data.descricao,
          versoes: det.data.versoes,
          origem: det.data.origem,
          atualizadoEm: det.data.atualizadoEm,
        },
        ...atual,
      ]);
    }
  }, [form]);

  const salvar = useCallback(async () => {
    if (!aberto) {
      return;
    }
    setErro(null);
    const res = await updateIpAssetAction({
      id: aberto.id,
      conteudo: rascunho,
      nota: nota || undefined,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const det = await getIpAsset(aberto.id);
    if (det.ok) {
      setAberto(det.data);
      setNota("");
    }
  }, [aberto, rascunho, nota]);

  const sujo = Boolean(aberto) && rascunho !== aberto?.conteudo;
  const podeSalvar = podeEscrever && sujo;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <SeletorDeAcervo
        acao={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setCriando((v) => !v)}
              type="button"
            >
              {criando ? "Cancelar" : "Novo"}
            </BotaoPrimario>
          ) : null
        }
        formulario={
          criando ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Campo htmlFor="ip-nome" label="Nome">
                <input
                  id="ip-nome"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nome: e.target.value }))
                  }
                  style={INPUT}
                  value={form.nome}
                />
              </Campo>
              <Campo htmlFor="ip-tipo" label="Tipo">
                <select
                  id="ip-tipo"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo: e.target.value }))
                  }
                  style={{ ...INPUT, cursor: "pointer" }}
                  value={form.tipo}
                >
                  {TIPOS.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo
                hint="de onde o ativo saiu — o ativo sobrevive ao engajamento"
                htmlFor="ip-origem"
                label="Origem"
              >
                <select
                  id="ip-origem"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, origem: e.target.value }))
                  }
                  style={{ ...INPUT, cursor: "pointer" }}
                  value={form.origem}
                >
                  <option value="">Nenhuma</option>
                  {engajamentos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo} · {e.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <BotaoPrimario
                disabled={form.nome.trim().length < 2}
                onClick={criar}
                type="button"
              >
                Criar
              </BotaoPrimario>
            </div>
          ) : null
        }
        icone="book"
        itens={lista.map((a) => ({
          id: a.id,
          titulo: a.nome,
          detalhe: `${a.tipo} · v${a.versoes}${a.origem ? ` · ${a.origem}` : ""}`,
        }))}
        onSelecionar={abrir}
        selecionadoId={aberto?.id ?? null}
        titulo="Acervo"
        vazio="Acervo vazio. É aqui que fica o que dá para reusar no próximo cliente em vez de refazer."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {aberto ? (
          <>
            <SectionCard
              icon="book"
              subtitle={`${aberto.slug} · versão atual v${aberto.versoes}`}
              title={aberto.nome}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    aria-label="O que mudou nesta revisão"
                    disabled={!podeEscrever}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="O que mudou nesta revisão"
                    style={{ ...INPUT, flex: 1, minWidth: 200 }}
                    value={nota}
                  />
                  <BotaoPrimario
                    disabled={!podeSalvar}
                    full={false}
                    onClick={salvar}
                    type="button"
                  >
                    {sujo ? "Salvar revisão" : "Sem alterações"}
                  </BotaoPrimario>
                </div>

                <textarea
                  className="mono scroll"
                  disabled={!podeEscrever}
                  onChange={(e) => setRascunho(e.target.value)}
                  spellCheck={false}
                  style={{
                    minHeight: 380,
                    resize: "vertical",
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--r-md)",
                    padding: 13,
                    fontSize: "var(--fs-base)",
                    lineHeight: 1.65,
                    color: "var(--ink)",
                    outline: "none",
                  }}
                  value={rascunho}
                />
              </div>
            </SectionCard>

            <SectionCard
              icon="history"
              subtitle="append-only — editar cria revisão, nunca sobrescreve"
              title="Histórico"
            >
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {aberto.historico.map((h, i) => (
                  <li
                    key={h.versao}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 2px",
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                    }}
                  >
                    <Badge tone={i === 0 ? "green" : "neutral"}>
                      v{h.versao}
                    </Badge>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "var(--fs-base)",
                      }}
                    >
                      {h.nota ?? (
                        <span style={{ color: "var(--ink-faint)" }}>
                          sem nota
                        </span>
                      )}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: "var(--fs-nota)",
                        color: "var(--ink-faint)",
                      }}
                    >
                      {h.autorNome ?? "—"} ·{" "}
                      {new Date(h.criadoEm).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </>
        ) : (
          <SectionCard title="Nenhum ativo aberto">
            <p
              style={{
                margin: 0,
                padding: 24,
                textAlign: "center",
                fontSize: "var(--fs-base)",
                color: "var(--ink-muted)",
              }}
            >
              Escolha um ativo na lista para ver e editar.
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
