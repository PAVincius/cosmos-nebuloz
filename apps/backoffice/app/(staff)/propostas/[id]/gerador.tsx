"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import type { CatalogoComercial } from "@/app/actions/catalogo-comercial";
import { submitProposalAction } from "@/app/actions/proposals";
import {
  type PropostaParaEdicao,
  salvarEscopoAction,
} from "@/app/actions/proposta-escopo";
import type { ServiceRow } from "@/app/actions/services";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { formatarBRL } from "@/lib/comercial/formato";
import { planoPadrao } from "@/lib/comercial/plano-padrao";
import {
  precificarProposta,
  type UnidadeDeCobranca,
} from "@/lib/comercial/precificar";
import { validarProposta } from "@/lib/comercial/validacoes";

/**
 * Gerador de proposta — configuração à esquerda, documento à direita.
 *
 * O preço recalcula no cliente a cada mudança, com a mesma `precificarProposta`
 * que o servidor usa ao gravar. É o ponto da tela: negociar assentos e prazo na
 * frente do cliente com o documento se remontando, sem uma ida ao servidor por
 * tecla — e sem duas contas que possam divergir.
 */

const TROCA = { display: "flex", gap: 8, flexWrap: "wrap" } as const;

const ROTULO_DE_STATUS: Record<string, string> = {
  AGUARDANDO_APROVACAO: "na fila de aprovação",
  ENVIADA: "enviada",
  ACEITA: "aceita",
  RECUSADA: "recusada",
};

function botaoDeEscolha(ativo: boolean) {
  return {
    flex: 1,
    minWidth: 92,
    padding: "9px 8px",
    borderRadius: "var(--r-md)",
    background: ativo ? "var(--accent-soft)" : "var(--surface-2)",
    border: `1px solid ${ativo ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`,
    color: "var(--ink)",
    cursor: "pointer",
    textAlign: "center" as const,
  };
}

export function Gerador({
  catalogo,
  servicos,
  proposta,
  podeEscrever,
}: {
  catalogo: CatalogoComercial;
  servicos: ServiceRow[];
  proposta: PropostaParaEdicao | null;
  podeEscrever: boolean;
}) {
  const router = useRouter();

  // Rascunho se edita; o resto se lê. Depois de enviada, o documento já saiu
  // da casa — a action recusa a alteração, e uma tela que deixasse mexer só
  // levaria a pessoa até o erro em vez de dizer isso de saída.
  const somenteLeitura = proposta !== null && proposta.status !== "RASCUNHO";
  const editavel = podeEscrever && !somenteLeitura;

  const [titulo, setTitulo] = useState(proposta?.titulo ?? "");
  const [cliente, setCliente] = useState(proposta?.clienteNome ?? "");
  const [contato, setContato] = useState(proposta?.contatoEmail ?? "");
  const [planoSlug, setPlanoSlug] = useState(
    proposta?.planoSlug ?? planoPadrao(catalogo.planos)
  );
  // `??` e não `||`: zero assentos é valor legítimo — é o que uma proposta de
  // diagnóstico tem. Com `||` ela reabria com 40 e virava contrato de assentos.
  const [assentos, setAssentos] = useState(proposta?.assentos ?? 40);
  const [modulos, setModulos] = useState<string[]>(
    proposta?.modulos ?? ["COSMOS"]
  );
  const [addOnSlugs, setAddOnSlugs] = useState<string[]>(
    proposta?.addOnSlugs ?? []
  );
  const [termoSlug, setTermoSlug] = useState(
    proposta?.termoSlug ??
      catalogo.termos.find((t) => t.meses === 12)?.slug ??
      ""
  );
  const [desconto, setDesconto] = useState(proposta?.descontoPercent ?? 0);
  const [servicoIds, setServicoIds] = useState<string[]>(
    proposta?.servicoIds ?? []
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<{ id: string; numero: string } | null>(
    proposta ? { id: proposta.id, numero: proposta.numero } : null
  );

  const alterna = (lista: string[], valor: string) =>
    lista.includes(valor)
      ? lista.filter((x) => x !== valor)
      : [...lista, valor];

  const plano = catalogo.planos.find((p) => p.slug === planoSlug);
  const termo = catalogo.termos.find((t) => t.slug === termoSlug);
  const escolhidos = servicos.filter((s) => servicoIds.includes(s.id));
  const addOnsEscolhidos = catalogo.addOns.filter((a) =>
    addOnSlugs.includes(a.slug)
  );

  const preco = useMemo(() => {
    if (!(plano && termo)) {
      return null;
    }
    return precificarProposta(
      {
        plano: {
          precoAssentoCentavos: plano.precoAssentoCentavos,
          minimoAssentos: plano.minimoAssentos,
        },
        modulos: modulos.map((m) => ({
          moduloId: m,
          precoMensalCentavos:
            catalogo.modulos.find((x) => x.modulo === m)?.precoMensalCentavos ??
            0,
        })),
        termo: { meses: termo.meses, descontoPercent: termo.descontoPercent },
        addOns: addOnsEscolhidos.map((a) => ({
          precoCentavos: a.precoCentavos,
          recorrente: a.recorrente,
        })),
        servicos: escolhidos.map((s) => ({
          precoCentavos: s.precoBaseCentavos,
          unidade: s.unidadeDeCobranca as UnidadeDeCobranca,
        })),
      },
      { assentos, descontoPercent: desconto }
    );
  }, [
    plano,
    termo,
    modulos,
    catalogo.modulos,
    addOnsEscolhidos,
    escolhidos,
    assentos,
    desconto,
  ]);

  const avisos = plano
    ? validarProposta({
        plano: {
          nome: plano.nome,
          limiteUsuarios: plano.limiteUsuarios,
          permiteRolesCustom: plano.permiteRolesCustom,
        },
        assentos,
        descontoPercent: desconto,
        addOns: addOnsEscolhidos.map((a) => ({
          nome: a.nome,
          exigeRolesCustom: a.exigeRolesCustom,
        })),
        servicos: escolhidos.map((s) => ({
          codigo: s.codigo,
          nome: s.nome,
          exigeLab: s.exigeLab,
          preRequisitos: s.preRequisitos,
        })),
      })
    : [];

  const precisaAprovacao = avisos.some((a) => a.bloqueiaEnvio);
  const emailValido = /.+@.+\..+/.test(contato);
  const podeEnviar =
    titulo.trim().length >= 2 && emailValido && modulos.length > 0;

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (salvando) {
      return;
    }
    setSalvando(true);
    setErro(null);

    const res = await salvarEscopoAction({
      ...(salvo ? { id: salvo.id } : {}),
      titulo: titulo.trim(),
      clienteNome: cliente.trim() || undefined,
      contatoEmail: contato.trim() || undefined,
      planoSlug,
      assentos,
      modulos,
      addOnSlugs,
      termoSlug,
      descontoPercent: desconto,
      servicoIds,
    });

    setSalvando(false);
    if (res.ok) {
      setSalvo(res.data);
      router.refresh();
      return;
    }
    setErro(res.error);
  };

  const enviar = async () => {
    if (!salvo || salvando) {
      return;
    }
    setSalvando(true);
    setErro(null);

    const res = await submitProposalAction({ id: salvo.id });
    setSalvando(false);
    if (res.ok) {
      router.push("/propostas");
      return;
    }
    setErro(res.error);
  };

  return (
    <form
      onSubmit={salvar}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "var(--gap)",
        alignItems: "start",
      }}
    >
      {/* ── configuração ─────────────────────────────────────────────── */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <SectionCard
          bodyStyle={{ padding: 14 }}
          icon="building"
          title="Cliente"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Campo htmlFor="g-titulo" label="Título da proposta">
              <input
                disabled={!editavel}
                id="g-titulo"
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Atlas Energia — plataforma e adoção"
                style={INPUT}
                value={titulo}
              />
            </Campo>
            <Campo htmlFor="g-cliente" label="Prospect">
              <input
                disabled={!editavel}
                id="g-cliente"
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ex.: Atlas Energia"
                style={INPUT}
                value={cliente}
              />
            </Campo>
            <Campo
              hint="destinatário da proposta"
              htmlFor="g-contato"
              label="Contato"
            >
              <input
                disabled={!editavel}
                id="g-contato"
                onChange={(e) => setContato(e.target.value)}
                placeholder="diretoria@cliente.com.br"
                style={INPUT}
                type="email"
                value={contato}
              />
            </Campo>
          </div>
        </SectionCard>

        <SectionCard bodyStyle={{ padding: 14 }} icon="layers" title="Escopo">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Campo htmlFor="g-plano" label="Plano">
              <div id="g-plano" style={TROCA}>
                {catalogo.planos.map((p) => (
                  <button
                    aria-pressed={p.slug === planoSlug}
                    disabled={!editavel}
                    key={p.slug}
                    onClick={() => setPlanoSlug(p.slug)}
                    style={botaoDeEscolha(p.slug === planoSlug)}
                    type="button"
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "var(--fs-base)",
                        fontWeight: 800,
                      }}
                    >
                      {p.nome}
                    </span>
                    <span
                      className="mono"
                      style={{
                        display: "block",
                        fontSize: "var(--fs-micro)",
                        color: "var(--ink-faint)",
                        marginTop: 2,
                      }}
                    >
                      {formatarBRL(p.precoAssentoCentavos)}/assento
                    </span>
                  </button>
                ))}
              </div>
            </Campo>

            <Campo
              hint={
                plano
                  ? `mínimo faturável: ${plano.minimoAssentos} · faturando ${preco?.assentosFaturados ?? assentos}`
                  : undefined
              }
              htmlFor="g-assentos"
              label="Assentos"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  disabled={!editavel}
                  id="g-assentos"
                  max="500"
                  min="5"
                  onChange={(e) => setAssentos(Number(e.target.value))}
                  step="5"
                  style={{ flex: 1, accentColor: "var(--accent)" }}
                  type="range"
                  value={assentos}
                />
                <span
                  className="mono"
                  style={{ width: 52, textAlign: "right", fontWeight: 700 }}
                >
                  {assentos}
                </span>
              </div>
            </Campo>

            <Campo htmlFor="g-modulos" label="Módulos">
              <div
                id="g-modulos"
                style={{ display: "flex", flexDirection: "column", gap: 7 }}
              >
                {catalogo.modulos.map((m) => {
                  const on = modulos.includes(m.modulo);
                  return (
                    <button
                      aria-pressed={on}
                      disabled={!editavel}
                      key={m.modulo}
                      onClick={() => setModulos(alterna(modulos, m.modulo))}
                      style={{
                        ...botaoDeEscolha(on),
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "left",
                      }}
                      type="button"
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: "var(--fs-base)",
                          fontWeight: 700,
                        }}
                      >
                        {m.modulo}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: "var(--fs-nota)",
                          color: "var(--ink-faint)",
                        }}
                      >
                        {m.precoMensalCentavos
                          ? `+${formatarBRL(m.precoMensalCentavos)}`
                          : "incluso"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Campo>

            {catalogo.addOns.length > 0 && (
              <Campo htmlFor="g-addons" label="Add-ons">
                <div
                  id="g-addons"
                  style={{ display: "flex", flexDirection: "column", gap: 7 }}
                >
                  {catalogo.addOns.map((a) => {
                    const on = addOnSlugs.includes(a.slug);
                    return (
                      <button
                        aria-pressed={on}
                        disabled={!editavel}
                        key={a.slug}
                        onClick={() =>
                          setAddOnSlugs(alterna(addOnSlugs, a.slug))
                        }
                        style={{
                          ...botaoDeEscolha(on),
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textAlign: "left",
                        }}
                        type="button"
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: "var(--fs-base)",
                              fontWeight: 700,
                            }}
                          >
                            {a.nome}
                          </span>
                          {a.nota && (
                            <span
                              style={{
                                display: "block",
                                fontSize: "var(--fs-nota)",
                                color: "var(--ink-faint)",
                              }}
                            >
                              {a.nota}
                            </span>
                          )}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: "var(--fs-nota)",
                            color: "var(--amber-text)",
                          }}
                        >
                          +{formatarBRL(a.precoCentavos)}
                          {a.recorrente ? "/mês" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Campo>
            )}
          </div>
        </SectionCard>

        {servicos.length > 0 && (
          <SectionCard
            bodyStyle={{ padding: 14 }}
            icon="briefcase"
            subtitle="Entram como linha própria na proposta"
            title="Serviços de consultoria"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {servicos.map((s) => {
                const on = servicoIds.includes(s.id);
                const recorrente = s.unidadeDeCobranca === "RETAINER";
                return (
                  <button
                    aria-pressed={on}
                    disabled={!editavel}
                    key={s.id}
                    onClick={() => setServicoIds(alterna(servicoIds, s.id))}
                    style={{
                      ...botaoDeEscolha(on),
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      textAlign: "left",
                    }}
                    type="button"
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: "var(--fs-base)",
                          fontWeight: 700,
                        }}
                      >
                        {s.nome}
                        {s.exigeLab && <Badge tone="blue">LAB</Badge>}
                      </span>
                      <span
                        className="mono"
                        style={{
                          display: "block",
                          fontSize: "var(--fs-nota)",
                          color: "var(--ink-faint)",
                        }}
                      >
                        {s.codigo} · {s.duracao ?? s.unidade}
                      </span>
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: "var(--fs-nota)",
                        color: recorrente
                          ? "var(--amber-text)"
                          : "var(--ink-muted)",
                      }}
                    >
                      {formatarBRL(s.precoBaseCentavos)}
                      {recorrente ? "/mês" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        )}

        <SectionCard bodyStyle={{ padding: 14 }} icon="tag" title="Comercial">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Campo
              hint={
                termo
                  ? `desconto de prazo: ${termo.descontoPercent}%`
                  : undefined
              }
              htmlFor="g-termo"
              label="Prazo de contrato"
            >
              <div id="g-termo" style={TROCA}>
                {catalogo.termos.map((t) => (
                  <button
                    aria-pressed={t.slug === termoSlug}
                    disabled={!editavel}
                    key={t.slug}
                    onClick={() => setTermoSlug(t.slug)}
                    style={botaoDeEscolha(t.slug === termoSlug)}
                    type="button"
                  >
                    <span
                      style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}
                    >
                      {t.nome}
                    </span>
                  </button>
                ))}
              </div>
            </Campo>

            <Campo
              hint="aplicado depois do desconto de prazo"
              htmlFor="g-desconto"
              label="Desconto comercial"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  disabled={!editavel}
                  id="g-desconto"
                  max="30"
                  min="0"
                  onChange={(e) => setDesconto(Number(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: precisaAprovacao
                      ? "var(--red)"
                      : "var(--amber)",
                  }}
                  type="range"
                  value={desconto}
                />
                <span
                  className="mono"
                  style={{
                    width: 52,
                    textAlign: "right",
                    fontWeight: 700,
                    color: precisaAprovacao ? "var(--red-text)" : "var(--ink)",
                  }}
                >
                  {desconto}%
                </span>
              </div>
            </Campo>
          </div>
        </SectionCard>
      </div>

      {/* ── documento ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--gap)",
          position: "sticky",
          top: 0,
        }}
      >
        <SectionCard
          bodyStyle={{ padding: 14 }}
          icon="fileCode"
          subtitle="Preview do documento que o cliente recebe"
          title="Proposta"
        >
          <div
            style={{
              paddingBottom: 12,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <div style={{ fontSize: "var(--fs-titulo)", fontWeight: 700 }}>
              {cliente || "— nome do prospect —"}
            </div>
            <div
              className="mono"
              style={{
                fontSize: "var(--fs-nota)",
                color: "var(--ink-faint)",
                marginTop: 3,
              }}
            >
              {contato || "contato@cliente"} · {plano?.nome ?? "—"} ·{" "}
              {termo?.nome ?? "—"}
            </div>
          </div>

          {preco && plano && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <LinhaDoDocumento
                detalhe={
                  preco.minimoAplicado
                    ? `mínimo de ${plano.minimoAssentos} assentos aplicado`
                    : `${formatarBRL(plano.precoAssentoCentavos)}/assento/mês`
                }
                rotulo={`${plano.nome} · ${preco.assentosFaturados} assentos`}
                valor={formatarBRL(preco.assentosCentavos)}
              />
              {preco.modulosCentavos > 0 && (
                <LinhaDoDocumento
                  detalhe="adicional mensal"
                  rotulo={`Módulos: ${modulos.join(", ")}`}
                  valor={formatarBRL(preco.modulosCentavos)}
                />
              )}
              {preco.addOnsRecorrentesCentavos > 0 && (
                <LinhaDoDocumento
                  detalhe={addOnsEscolhidos
                    .filter((a) => a.recorrente)
                    .map((a) => a.nome)
                    .join(" · ")}
                  rotulo="Add-ons recorrentes"
                  valor={formatarBRL(preco.addOnsRecorrentesCentavos)}
                />
              )}
              {preco.servicosRecorrentesCentavos > 0 && (
                <LinhaDoDocumento
                  detalhe={escolhidos
                    .filter((s) => s.unidadeDeCobranca === "RETAINER")
                    .map((s) => s.nome)
                    .join(" · ")}
                  rotulo="Serviços em retainer"
                  valor={formatarBRL(preco.servicosRecorrentesCentavos)}
                />
              )}
              {preco.descontoDePrazoCentavos > 0 && (
                <LinhaDoDocumento
                  rotulo={`Desconto ${termo?.nome.toLowerCase()}`}
                  tom="var(--green-text)"
                  valor={`−${formatarBRL(preco.descontoDePrazoCentavos)}`}
                />
              )}
              {preco.descontoComercialCentavos > 0 && (
                <LinhaDoDocumento
                  rotulo={`Desconto comercial ${desconto}%`}
                  tom="var(--green-text)"
                  valor={`−${formatarBRL(preco.descontoComercialCentavos)}`}
                />
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "12px 14px",
                  marginTop: 8,
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                }}
              >
                <span style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
                  Mensal recorrente
                </span>
                <span
                  style={{ fontSize: "var(--fs-display)", fontWeight: 700 }}
                >
                  {formatarBRL(preco.liquidoMensalCentavos)}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <Celula rotulo="ACV" valor={formatarBRL(preco.acvCentavos)} />
                <Celula
                  rotulo={`TCV (${preco.meses}m)`}
                  valor={formatarBRL(preco.tcvCentavos)}
                />
                <Celula
                  rotulo="Setup + projetos"
                  valor={
                    preco.umaVezCentavos
                      ? formatarBRL(preco.umaVezCentavos)
                      : "—"
                  }
                />
              </div>
            </div>
          )}
        </SectionCard>

        {avisos.length > 0 && (
          <SectionCard
            bodyStyle={{ padding: 14 }}
            icon="alert"
            title="Validações"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {avisos.map((a) => (
                <span
                  key={a.chave + a.texto}
                  style={{
                    fontSize: "var(--fs-nota)",
                    fontWeight: 600,
                    lineHeight: 1.5,
                    color:
                      a.tom === "red"
                        ? "var(--red-text)"
                        : a.tom === "blue"
                          ? "var(--blue-text)"
                          : "var(--amber-text)",
                  }}
                >
                  · {a.texto}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {erro && <Erro>{erro}</Erro>}

        {somenteLeitura && (
          <SectionCard
            bodyStyle={{ padding: 14 }}
            icon="lock"
            title={`Proposta ${ROTULO_DE_STATUS[proposta.status] ?? proposta.status}`}
          >
            <span
              style={{
                fontSize: "var(--fs-base)",
                lineHeight: 1.55,
                color: "var(--ink-muted)",
              }}
            >
              O escopo desta proposta já foi enviado ao cliente e não é mais
              editável — o que ele recebeu precisa continuar valendo. Para mudar
              preço ou escopo, monte uma proposta nova.
            </span>
          </SectionCard>
        )}

        {editavel ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <BotaoPrimario disabled={salvando || !podeEnviar}>
              {salvo ? "Salvar alterações" : "Criar rascunho"}
            </BotaoPrimario>
            {salvo && (
              <BotaoPrimario
                disabled={salvando || !podeEnviar}
                onClick={enviar}
                type="button"
              >
                {precisaAprovacao ? "Enviar para aprovação" : "Enviar proposta"}
              </BotaoPrimario>
            )}
            {!podeEnviar && (
              <span
                style={{
                  fontSize: "var(--fs-nota)",
                  color: "var(--ink-faint)",
                }}
              >
                Para enviar: título, contato com e-mail válido e ao menos um
                módulo.
              </span>
            )}
          </div>
        ) : (
          !somenteLeitura && (
            <span
              style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
            >
              Somente leitura — seu papel no back-office é MEMBER.
            </span>
          )
        )}
      </div>
    </form>
  );
}

function LinhaDoDocumento({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px dashed var(--hairline)",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: tom,
          }}
        >
          {rotulo}
        </span>
        {detalhe && (
          <span
            style={{
              display: "block",
              fontSize: "var(--fs-nota)",
              color: "var(--ink-faint)",
            }}
          >
            {detalhe}
          </span>
        )}
      </span>
      <span
        className="mono"
        style={{ fontSize: "var(--fs-base)", fontWeight: 700, color: tom }}
      >
        {valor}
      </span>
    </div>
  );
}

function Celula({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div
      style={{
        padding: "9px 11px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {rotulo}
      </div>
      <div
        className="mono"
        style={{ fontSize: "var(--fs-base)", fontWeight: 700, marginTop: 3 }}
      >
        {valor}
      </div>
    </div>
  );
}
