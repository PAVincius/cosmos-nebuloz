"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { type FormEvent, useCallback, useState, useTransition } from "react";
import {
  createServiceAction,
  type ServiceRow,
  setServiceAtivoAction,
} from "@/app/actions/services";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { Vazio } from "@/components/vazio";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";

/**
 * Catálogo de serviços.
 *
 * O preço vive em centavos inteiros no banco e é digitado em reais na tela. A
 * conversão fica num lugar só, em lib/comercial/formato — espalhá-la é como se
 * erra a unidade, e o
 * sintoma aparece longe da causa, na soma de uma proposta.
 */

const MODALIDADES = [
  { valor: "PROJETO", rotulo: "Projeto" },
  { valor: "RETAINER", rotulo: "Retainer" },
  { valor: "LICENCA", rotulo: "Licença" },
];

const FORM_VAZIO = {
  codigo: "",
  nome: "",
  modalidade: "PROJETO",
  preco: "",
  unidade: "projeto",
};

/** Tirar do catálogo some da lista de escolha de quem monta proposta no
 *  mesmo instante — passa pela barreira. Devolver tem volta e continua um
 *  clique. Os dois ficam fora do <Link> (irmãos, não filhos): é o que os
 *  mantém fora da navegação — `stopPropagation` não bastaria. */
function acaoDaLinha(
  s: ServiceRow,
  alternando: boolean,
  onAlternar: (id: string, ativo: boolean) => void
) {
  if (s.ativo) {
    return (
      <ConfirmarAcao
        alvo={`${s.codigo} · ${s.nome}`}
        consequencia="Sai da lista de escolha do gerador de proposta agora; propostas já emitidas não mudam."
        executando={alternando}
        onConfirmar={() => onAlternar(s.id, false)}
        rotulo="Tirar do catálogo"
        tom="red"
      />
    );
  }
  return (
    <button
      className="btn"
      disabled={alternando}
      onClick={() => onAlternar(s.id, true)}
      style={{
        padding: "4px 10px",
        borderRadius: "var(--r-sm)",
        border: "1px solid var(--hairline)",
        background: "none",
        color: "var(--ink-muted)",
        fontSize: "var(--fs-nota)",
        fontWeight: 600,
        cursor: alternando ? "not-allowed" : "pointer",
        opacity: alternando ? 0.6 : 1,
      }}
      type="button"
    >
      {alternando ? "Devolvendo…" : "Devolver"}
    </button>
  );
}

/** Quem só lê vê "Ativo" no lugar da ação; o inativo já tem a palavra na
 *  própria linha, então aqui não repete. */
function badgeDeLeitura(s: ServiceRow) {
  return s.ativo ? <Badge tone="green">Ativo</Badge> : null;
}

/** Uma linha do catálogo. Extraída porque a linha carrega toda a decisão
 *  visual — inativo esmaecido, preço com unidade, ação conforme o papel — e
 *  inline ela empurrava o componente inteiro acima do limite de complexidade. */
function LinhaServico({
  servico: s,
  primeira,
  podeEscrever,
  alternando,
  onAlternar,
}: {
  servico: ServiceRow;
  primeira: boolean;
  podeEscrever: boolean;
  /** A chamada desta linha está no ar: o botão trava e diz. */
  alternando: boolean;
  onAlternar: (id: string, ativo: boolean) => void;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        // Fora de catálogo continua visível, só apagado: sumir faria o
        // operador cadastrar um duplicado com o mesmo código.
        opacity: s.ativo ? 1 : 0.55,
      }}
    >
      {/* A linha inteira leva ao detalhe. O código é a chave da rota porque é
          o que aparece em proposta e contrato — a URL fica legível e a pessoa
          consegue digitá-la a partir do documento que tem na mão. */}
      <Link
        className="navitem"
        href={`/servicos/${encodeURIComponent(s.codigo)}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1,
          minWidth: 0,
          padding: "11px 8px",
          margin: "0 -6px",
          borderRadius: "var(--r-sm)",
          color: "var(--ink)",
          textDecoration: "none",
        }}
      >
        <span
          className="mono"
          style={{ fontSize: "var(--fs-nota)", fontWeight: 700, width: 60 }}
        >
          {s.codigo}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-base)" }}>
          {s.nome}
        </span>
        <Badge tone="neutral">
          {MODALIDADES.find((m) => m.valor === s.modalidade)?.rotulo ??
            s.modalidade}
        </Badge>
        {/* A palavra além da opacidade — nos dois papéis: quem só lê via
            "Fora" à direita, quem escreve via só o "Devolver" e tinha de
            deduzir o estado do esmaecimento. */}
        {s.ativo ? null : <Badge tone="neutral">Inativo</Badge>}
        <span
          className="mono"
          style={{ fontSize: "var(--fs-base)", color: "var(--accent-text)" }}
        >
          {formatarBRL(s.precoBaseCentavos)}
          <span style={{ color: "var(--ink-faint)" }}>/{s.unidade}</span>
        </span>
      </Link>
      {podeEscrever
        ? acaoDaLinha(s, alternando, onAlternar)
        : badgeDeLeitura(s)}
    </li>
  );
}

export function Catalogo({
  iniciais,
  podeEscrever,
}: {
  iniciais: ServiceRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  // O `pendente` desabilita o botão no mesmo render em que o envio começa —
  // é o que faz o segundo clique não cadastrar um segundo serviço.
  const [pendente, iniciar] = useTransition();

  const criar = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      setErro(null);
      iniciar(async () => {
        const res = await createServiceAction({
          codigo: form.codigo,
          nome: form.nome,
          modalidade: form.modalidade as "PROJETO",
          precoBaseCentavos: paraCentavos(form.preco),
          unidade: form.unidade,
        });
        if (!res.ok) {
          setErro(res.error);
          return;
        }
        setLista((atual) => [
          {
            id: res.data.id,
            codigo: res.data.codigo,
            nome: form.nome,
            descricao: null,
            modalidade: form.modalidade,
            precoBaseCentavos: paraCentavos(form.preco),
            unidade: form.unidade,
            ativo: true,
            // Espelha os defaults que a action grava. Divergir aqui faria a
            // linha recém-criada aparecer diferente do que ficou no banco até
            // o próximo carregamento.
            trilha: "readiness",
            unidadeDeCobranca:
              form.modalidade === "RETAINER" ? "RETAINER" : "PROJETO",
            duracao: null,
            entregaveis: [],
            papeis: [],
            preRequisitos: [],
            moduloVinculado: null,
            exigeLab: false,
          },
          ...atual,
        ]);
        setCriando(false);
        setForm(FORM_VAZIO);
      });
    },
    [form]
  );

  // Id da linha cuja chamada está no ar: dois cliques rápidos em Devolver
  // eram duas chamadas.
  const [alternandoId, setAlternandoId] = useState<string | null>(null);
  const alternar = useCallback(async (id: string, ativo: boolean) => {
    setErro(null);
    setAlternandoId(id);
    try {
      const res = await setServiceAtivoAction({ id, ativo });
      if (res.ok) {
        setLista((atual) =>
          atual.map((s) => (s.id === id ? { ...s, ativo } : s))
        );
      } else {
        setErro(res.error);
      }
    } finally {
      setAlternandoId(null);
    }
  }, []);

  const podeCriar =
    form.codigo.trim().length >= 2 && form.nome.trim().length >= 2 && !pendente;
  const ativos = lista.filter((s) => s.ativo).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        action={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setCriando((v) => !v)}
              type="button"
            >
              {criando ? "Fechar" : "Novo serviço"}
            </BotaoPrimario>
          ) : null
        }
        icon="briefcase"
        subtitle={`${ativos === 1 ? "1 ativo" : `${ativos} ativos`} de ${lista.length}`}
        title="Catálogo"
      >
        {criando ? (
          // `<form>` e não `<div>`: é o que faz Enter num campo submeter.
          <form
            aria-label="Novo serviço"
            onSubmit={criar}
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              paddingBottom: 14,
              marginBottom: 14,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <Campo htmlFor="s-codigo" label="Código">
              <input
                id="s-codigo"
                onChange={(e) =>
                  setForm((f) => ({ ...f, codigo: e.target.value }))
                }
                placeholder="SV-09"
                style={INPUT}
                value={form.codigo}
              />
            </Campo>
            <Campo htmlFor="s-nome" label="Nome">
              <input
                id="s-nome"
                onChange={(e) =>
                  setForm((f) => ({ ...f, nome: e.target.value }))
                }
                style={INPUT}
                value={form.nome}
              />
            </Campo>
            <Campo htmlFor="s-modalidade" label="Modalidade">
              <select
                id="s-modalidade"
                onChange={(e) =>
                  setForm((f) => ({ ...f, modalidade: e.target.value }))
                }
                style={{ ...INPUT, cursor: "pointer" }}
                value={form.modalidade}
              >
                {MODALIDADES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              hint={`grava ${formatarBRL(paraCentavos(form.preco))}`}
              htmlFor="s-preco"
              label="Preço base"
            >
              <input
                id="s-preco"
                inputMode="numeric"
                onChange={(e) =>
                  setForm((f) => ({ ...f, preco: e.target.value }))
                }
                placeholder="1.250,00"
                style={INPUT}
                value={form.preco}
              />
            </Campo>
            <Campo htmlFor="s-unidade" label="Unidade">
              <input
                id="s-unidade"
                onChange={(e) =>
                  setForm((f) => ({ ...f, unidade: e.target.value }))
                }
                placeholder="projeto, mês, usuário/mês"
                style={INPUT}
                value={form.unidade}
              />
            </Campo>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <BotaoPrimario disabled={!podeCriar} type="submit">
                {pendente ? "Cadastrando…" : "Cadastrar"}
              </BotaoPrimario>
            </div>
          </form>
        ) : null}

        {lista.length === 0 ? (
          <Vazio>
            Catálogo vazio. Sem serviço cadastrado, proposta vira texto livre e
            o Benchmark fica sem eixo de comparação.
          </Vazio>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {lista.map((s, i) => (
              <LinhaServico
                alternando={alternandoId === s.id}
                key={s.id}
                onAlternar={alternar}
                podeEscrever={podeEscrever}
                primeira={i === 0}
                servico={s}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
