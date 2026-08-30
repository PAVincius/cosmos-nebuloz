"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  createServiceAction,
  type ServiceRow,
  setServiceAtivoAction,
} from "@/app/actions/services";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
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

/** Uma linha do catálogo. Extraída porque a linha carrega toda a decisão
 *  visual — inativo esmaecido, preço com unidade, ação conforme o papel — e
 *  inline ela empurrava o componente inteiro acima do limite de complexidade. */
function LinhaServico({
  servico: s,
  primeira,
  podeEscrever,
  onAlternar,
}: {
  servico: ServiceRow;
  primeira: boolean;
  podeEscrever: boolean;
  onAlternar: (id: string, ativo: boolean) => void;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        // Fora de catálogo continua visível, só apagado: sumir faria o
        // operador cadastrar um duplicado com o mesmo código.
        opacity: s.ativo ? 1 : 0.55,
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
      <Badge tone="neutral">{s.modalidade}</Badge>
      <span
        className="mono"
        style={{ fontSize: "var(--fs-base)", color: "var(--accent-text)" }}
      >
        {formatarBRL(s.precoBaseCentavos)}
        <span style={{ color: "var(--ink-faint)" }}>/{s.unidade}</span>
      </span>
      {podeEscrever ? (
        <button
          className="btn"
          onClick={() => onAlternar(s.id, !s.ativo)}
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
          {s.ativo ? "Tirar do catálogo" : "Devolver"}
        </button>
      ) : (
        <Badge tone={s.ativo ? "green" : "neutral"}>
          {s.ativo ? "Ativo" : "Fora"}
        </Badge>
      )}
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
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    modalidade: "PROJETO",
    preco: "",
    unidade: "projeto",
  });

  const criar = useCallback(async () => {
    setErro(null);
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
        // Espelha os defaults que a action grava. Divergir aqui faria a linha
        // recém-criada aparecer diferente do que ficou no banco até o próximo
        // carregamento.
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
    setForm({
      codigo: "",
      nome: "",
      modalidade: "PROJETO",
      preco: "",
      unidade: "projeto",
    });
  }, [form]);

  const alternar = useCallback(async (id: string, ativo: boolean) => {
    setErro(null);
    const res = await setServiceAtivoAction({ id, ativo });
    if (res.ok) {
      setLista((atual) =>
        atual.map((s) => (s.id === id ? { ...s, ativo } : s))
      );
    } else {
      setErro(res.error);
    }
  }, []);

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
              {criando ? "Cancelar" : "Novo serviço"}
            </BotaoPrimario>
          ) : null
        }
        icon="briefcase"
        subtitle={`${lista.filter((s) => s.ativo).length} ativo(s) de ${lista.length}`}
        title="Catálogo"
      >
        {criando ? (
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
              <BotaoPrimario
                disabled={
                  form.codigo.trim().length < 2 || form.nome.trim().length < 2
                }
                onClick={criar}
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
            Catálogo vazio. Sem serviço cadastrado, proposta vira texto livre e
            o Benchmark fica sem eixo de comparação.
          </p>
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
