"use client";

import type { ProductModule } from "@repo/database";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type ServiceDetail,
  updateServiceAction,
} from "@/app/actions/services";
import { Campo, Erro, INPUT } from "@/components/campo";
import {
  PerguntaDescartar,
  rascunhoMudou,
} from "@/components/pergunta-descartar";
import { WriteButton } from "@/components/write-button";
import { centavosParaCampo, paraCentavos } from "@/lib/comercial/formato";
import { useAvisoAoSair } from "@/lib/rascunho-sujo";
import { ROTULO_UNIDADE, TRILHA } from "./detalhe";

/**
 * Edição inline de um serviço do catálogo.
 *
 * `updateServiceAction` existia completa — com diff campo a campo na auditoria
 * — e nenhuma tela a chamava: corrigir um preço digitado errado exigia SQL, e
 * o detalhe avisava "Sem entregáveis cadastrados" sem oferecer caminho.
 *
 * Abre pela URL (`?editar=1`, ou `?editar=entregaveis` para chegar com o foco
 * no campo), não por estado de cliente: o botão vive no cabeçalho da página,
 * que é componente de servidor, e o atalho vive dentro do detalhe. Um `<Link>`
 * alcança os dois sem subir estado por contexto. Inline e não modal: modo
 * Operate — a pessoa está corrigindo um cadastro, não decidindo nada.
 *
 * As três listas são textarea com um item por linha. É o formato mais simples
 * que passa no `EditarSchema` e o que a pessoa já tem na mão quando copia de
 * uma proposta.
 */

const TRILHAS = ["readiness", "adoption", "enablement", "custom"] as const;
const UNIDADES = ["PROJETO", "SPRINT", "HORA", "RETAINER"] as const;

type Trilha = (typeof TRILHAS)[number];
type Unidade = (typeof UNIDADES)[number];

const ehTrilha = (v: string): v is Trilha =>
  (TRILHAS as readonly string[]).includes(v);
const ehUnidade = (v: string): v is Unidade =>
  (UNIDADES as readonly string[]).includes(v);

/** Uma linha por item; linha vazia e espaço nas pontas não viram item. */
function linhas(texto: string): string[] {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

const AREA = { ...INPUT, fontWeight: 500, resize: "vertical" } as const;

/** O serviço na forma dos campos — o estado inicial e a base do rascunho. */
function formDoServico(servico: ServiceDetail) {
  return {
    nome: servico.nome,
    descricao: servico.descricao ?? "",
    preco: centavosParaCampo(servico.precoBaseCentavos),
    unidade: servico.unidade,
    trilha: ehTrilha(servico.trilha) ? servico.trilha : "readiness",
    unidadeDeCobranca: ehUnidade(servico.unidadeDeCobranca)
      ? servico.unidadeDeCobranca
      : "PROJETO",
    duracao: servico.duracao ?? "",
    entregaveis: servico.entregaveis.join("\n"),
    papeis: servico.papeis.join("\n"),
    preRequisitos: servico.preRequisitos.map((p) => p.codigo).join("\n"),
    moduloVinculado: servico.moduloVinculado ?? "",
    exigeLab: servico.exigeLab,
  };
}

export function EditarServico({
  servico,
  podeEscrever,
  modulos,
  focarEm,
}: {
  servico: ServiceDetail;
  podeEscrever: boolean;
  /** Módulos da plataforma, vindos do servidor — `@repo/database` não entra
   *  no bundle do browser. */
  modulos: ProductModule[];
  /** Campo que recebe o foco ao abrir — o atalho "Cadastrar entregáveis" do
   *  detalhe chega por aqui. */
  focarEm?: "entregaveis";
}) {
  const router = useRouter();
  const caminho = usePathname();
  const entregaveisRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState(() => formDoServico(servico));
  // O que está gravado, na forma dos campos: o rascunho é a diferença entre
  // isto e `form`. Salvar move a base; recarregar do servidor não a moveria
  // sozinho (o preço digitado "1250" volta como "1250,00").
  const [base, setBase] = useState(() => formDoServico(servico));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [perguntandoFechar, setPerguntandoFechar] = useState(false);
  const sujo = rascunhoMudou(form, base);
  useAvisoAoSair(sujo);

  useEffect(() => {
    if (focarEm === "entregaveis") {
      entregaveisRef.current?.focus();
    }
  }, [focarEm]);

  const travado = !podeEscrever || salvando;
  /** `<select>` devolve string; o contrato da action é o enum. Estreitar aqui
   *  mantém a validação de verdade dentro da action. */
  const ehModulo = (v: string): v is ProductModule =>
    (modulos as readonly string[]).includes(v);
  const muda = <K extends keyof typeof form>(
    campo: K,
    valor: (typeof form)[K]
  ) => setForm((f) => ({ ...f, [campo]: valor }));

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    if (travado) {
      return;
    }
    setSalvando(true);
    setErro(null);
    setSalvo(false);

    const res = await updateServiceAction({
      id: servico.id,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      precoBaseCentavos: paraCentavos(form.preco),
      unidade: form.unidade.trim(),
      trilha: form.trilha,
      unidadeDeCobranca: form.unidadeDeCobranca,
      duracao: form.duracao.trim() || null,
      entregaveis: linhas(form.entregaveis),
      papeis: linhas(form.papeis),
      preRequisitos: linhas(form.preRequisitos).map((c) => c.toUpperCase()),
      moduloVinculado: ehModulo(form.moduloVinculado)
        ? form.moduloVinculado
        : null,
      exigeLab: form.exigeLab,
    });

    setSalvando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setSalvo(true);
    setBase(form);
    router.refresh();
  };

  // "Fechar edição" descartava sem perguntar — era um Link para a mesma rota
  // sem `?editar`. Com rascunho, pergunta antes; limpo, fecha direto.
  const fecharEdicao = () => {
    if (sujo) {
      setPerguntandoFechar(true);
      return;
    }
    router.push(caminho);
  };

  return (
    <form
      aria-label={`Editar ${servico.codigo}`}
      onSubmit={salvar}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "16px 18px",
        borderRadius: "var(--r-lg)",
        border: "1px solid rgba(var(--accent-rgb),.35)",
        background: "var(--surface)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontSize: "var(--fs-forte)", fontWeight: 700 }}>
          Editar {servico.codigo}
        </span>
        <button
          className="btn"
          onClick={fecharEdicao}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "inherit",
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            color: "var(--ink-muted)",
            cursor: "pointer",
          }}
          type="button"
        >
          Fechar edição
        </button>
      </div>

      {perguntandoFechar ? (
        <PerguntaDescartar
          explicacao="O que você editou e ainda não salvou some. Para manter, volte e salve antes de fechar."
          nome={servico.codigo}
          onDescartar={() => router.push(caminho)}
          onVoltar={() => setPerguntandoFechar(false)}
        />
      ) : null}

      {erro ? <Erro>{erro}</Erro> : null}
      {salvo ? (
        <output
          style={{
            display: "block",
            padding: "9px 11px",
            borderRadius: "var(--r-md)",
            background: "var(--green-soft)",
            border: "1px solid rgba(var(--green-rgb),.3)",
            color: "var(--green-text)",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          Serviço atualizado
        </output>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        }}
      >
        <Campo htmlFor="e-nome" label="Nome">
          <input
            disabled={travado}
            id="e-nome"
            maxLength={120}
            onChange={(e) => muda("nome", e.target.value)}
            required
            style={INPUT}
            value={form.nome}
          />
        </Campo>
        <Campo
          hint={`grava ${centavosParaCampo(paraCentavos(form.preco))}`}
          htmlFor="e-preco"
          label="Preço base"
        >
          <input
            disabled={travado}
            id="e-preco"
            inputMode="numeric"
            onChange={(e) => muda("preco", e.target.value)}
            style={INPUT}
            value={form.preco}
          />
        </Campo>
        <Campo
          hint="texto livre que aparece depois do preço"
          htmlFor="e-unidade"
          label="Unidade"
        >
          <input
            disabled={travado}
            id="e-unidade"
            maxLength={30}
            onChange={(e) => muda("unidade", e.target.value)}
            style={INPUT}
            value={form.unidade}
          />
        </Campo>
        <Campo htmlFor="e-cobranca" label="Modelo de cobrança">
          <select
            disabled={travado}
            id="e-cobranca"
            onChange={(e) =>
              ehUnidade(e.target.value) &&
              muda("unidadeDeCobranca", e.target.value)
            }
            style={{ ...INPUT, cursor: "pointer" }}
            value={form.unidadeDeCobranca}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {ROTULO_UNIDADE[u] ?? u}
              </option>
            ))}
          </select>
        </Campo>
        <Campo htmlFor="e-trilha" label="Trilha">
          <select
            disabled={travado}
            id="e-trilha"
            onChange={(e) =>
              ehTrilha(e.target.value) && muda("trilha", e.target.value)
            }
            style={{ ...INPUT, cursor: "pointer" }}
            value={form.trilha}
          >
            {TRILHAS.map((t) => (
              <option key={t} value={t}>
                {TRILHA[t]?.label ?? t}
              </option>
            ))}
          </select>
        </Campo>
        <Campo htmlFor="e-duracao" label="Duração">
          <input
            disabled={travado}
            id="e-duracao"
            maxLength={60}
            onChange={(e) => muda("duracao", e.target.value)}
            placeholder="Ex.: 3 semanas"
            style={INPUT}
            value={form.duracao}
          />
        </Campo>
        <Campo htmlFor="e-modulo" label="Módulo vinculado">
          <select
            disabled={travado}
            id="e-modulo"
            onChange={(e) => muda("moduloVinculado", e.target.value)}
            style={{ ...INPUT, cursor: "pointer" }}
            value={form.moduloVinculado}
          >
            <option value="">Nenhum — independente de módulo</option>
            {modulos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "var(--fs-base)",
              fontWeight: 600,
              padding: "10px 0",
            }}
          >
            <input
              checked={form.exigeLab}
              disabled={travado}
              onChange={(e) => muda("exigeLab", e.target.checked)}
              type="checkbox"
            />
            Exige capacidade no LAB
          </label>
        </div>
      </div>

      <Campo htmlFor="e-descricao" label="Descrição">
        <textarea
          disabled={travado}
          id="e-descricao"
          maxLength={500}
          onChange={(e) => muda("descricao", e.target.value)}
          rows={2}
          style={AREA}
          value={form.descricao}
        />
      </Campo>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        }}
      >
        <Campo
          hint="um por linha, até 20 — vira anexo da proposta"
          htmlFor="e-entregaveis"
          label="Entregáveis"
        >
          <textarea
            disabled={travado}
            id="e-entregaveis"
            onChange={(e) => muda("entregaveis", e.target.value)}
            ref={entregaveisRef}
            rows={5}
            style={AREA}
            value={form.entregaveis}
          />
        </Campo>
        <Campo
          hint="um por linha, até 12"
          htmlFor="e-papeis"
          label="Papéis no time"
        >
          <textarea
            disabled={travado}
            id="e-papeis"
            onChange={(e) => muda("papeis", e.target.value)}
            rows={5}
            style={AREA}
            value={form.papeis}
          />
        </Campo>
        <Campo
          hint="códigos de outros serviços, um por linha, até 10"
          htmlFor="e-prereq"
          label="Pré-requisitos"
        >
          <textarea
            className="mono"
            disabled={travado}
            id="e-prereq"
            onChange={(e) => muda("preRequisitos", e.target.value)}
            placeholder="SV-01"
            rows={5}
            style={AREA}
            value={form.preRequisitos}
          />
        </Campo>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <WriteButton
          canWrite={podeEscrever}
          disabled={salvando || form.nome.trim().length < 2}
          type="submit"
        >
          {salvando ? "Salvando…" : "Salvar alterações"}
        </WriteButton>
      </div>
    </form>
  );
}
