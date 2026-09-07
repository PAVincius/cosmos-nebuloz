"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";
import type { ContaView } from "@/app/actions/empresa/financeiro";
// `criarLancamento`/`atualizarLancamento` entram aqui só para os
// `Parameters<typeof ...>[0]` abaixo, no mesmo padrão de novo-lead-dialog.tsx
// — quem chama a action de fato é `onCriar`/`onAtualizar`, vindos de
// lancamentos.tsx.
import type {
  atualizarLancamento,
  criarLancamento,
} from "@/app/actions/empresa/livro";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import type { LinhaDoLivro } from "@/lib/empresa/livro";
import { ROTULO_CENTRO } from "@/lib/empresa/plano-de-contas";
import type { Result } from "@/lib/safe-action";

/**
 * Diálogo de criar/editar lançamento (Task 5, spec §4). Um só componente para
 * as duas operações: `linha === null` é criação, `linha` presente é edição —
 * mesma ideia de `LeadDialog` ser controlado pela presença do registro.
 *
 * Corpo desmonta quando `aberto` é falso (o `{aberto ? <Formulario/> : null}`
 * abaixo), para o `useState(formInicial(...))` não vazar rascunho de uma
 * linha para a próxima abertura.
 */

type CriarInput = Parameters<typeof criarLancamento>[0];
type AtualizarInput = Parameters<typeof atualizarLancamento>[0];

type FormLancamento = {
  competencia: string;
  data: string;
  conta: string;
  descricao: string;
  valor: string;
  contraparte: string;
  documento: string;
  nota: string;
};

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function competenciaAtual(): string {
  return hojeIso().slice(0, 7);
}

/** Inverso informal de `formatarBRL`, sem o símbolo de moeda — o texto que
 *  entra de novo no campo editável. `paraCentavos` só olha dígitos, então o
 *  separador de milhar do `toLocaleString` não atrapalha o round-trip. */
function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formInicial(linha: LinhaDoLivro | null): FormLancamento {
  if (linha) {
    return {
      competencia: linha.competencia,
      conta: linha.conta,
      contraparte: linha.contraparte ?? "",
      data: linha.data,
      descricao: linha.descricao,
      documento: linha.documento ?? "",
      nota: linha.nota ?? "",
      valor: centavosParaTexto(linha.valorCentavos),
    };
  }
  return {
    competencia: competenciaAtual(),
    conta: "",
    contraparte: "",
    data: hojeIso(),
    descricao: "",
    documento: "",
    nota: "",
    valor: "",
  };
}

function podeSalvar(f: FormLancamento): boolean {
  return (
    f.competencia.length > 0 &&
    f.data.length > 0 &&
    f.conta.length > 0 &&
    f.descricao.trim().length > 0 &&
    f.valor.trim().length > 0
  );
}

function textoOuNulo(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

/** Agrupa as contas ativas por centro de custo, na ordem em que chegam
 *  (grupo/ordem/conta, de `contasDoPlano`) — o `<select>` mostra um
 *  `<optgroup>` por centro. */
function agruparPorCentro(contas: ContaView[]): [string, ContaView[]][] {
  const grupos = new Map<string, ContaView[]>();
  for (const c of contas) {
    const rotulo = c.centroDeCusto
      ? ROTULO_CENTRO[c.centroDeCusto]
      : "Sem centro";
    const lista = grupos.get(rotulo);
    if (lista) {
      lista.push(c);
    } else {
      grupos.set(rotulo, [c]);
    }
  }
  return Array.from(grupos.entries());
}

export function LancamentoDialog({
  aberto,
  linha,
  contas,
  onClose,
  onCriar,
  onAtualizar,
}: {
  aberto: boolean;
  /** `null` = criar; presente = editar essa linha. */
  linha: LinhaDoLivro | null;
  contas: ContaView[];
  onClose: () => void;
  onCriar: (input: CriarInput) => Promise<Result<{ id: string }>>;
  onAtualizar: (input: AtualizarInput) => Promise<Result<{ id: string }>>;
}) {
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          onClose();
        }
      }}
      open={aberto}
    >
      <DialogContent
        className="sm:max-w-xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
          color: "var(--ink)",
        }}
      >
        {aberto ? (
          <Formulario
            contas={contas}
            linha={linha}
            onAtualizar={onAtualizar}
            onClose={onClose}
            onCriar={onCriar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  linha,
  contas,
  onClose,
  onCriar,
  onAtualizar,
}: {
  linha: LinhaDoLivro | null;
  contas: ContaView[];
  onClose: () => void;
  onCriar: (input: CriarInput) => Promise<Result<{ id: string }>>;
  onAtualizar: (input: AtualizarInput) => Promise<Result<{ id: string }>>;
}) {
  const [form, setForm] = useState<FormLancamento>(() => formInicial(linha));
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const grupos = agruparPorCentro(contas.filter((c) => c.ativa));

  function mudar<K extends keyof FormLancamento>(
    campo: K,
    valor: FormLancamento[K]
  ) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    setErro(null);
    setPendente(true);
    const dados = {
      competencia: form.competencia,
      conta: form.conta,
      contraparte: textoOuNulo(form.contraparte),
      data: form.data,
      descricao: form.descricao.trim(),
      documento: textoOuNulo(form.documento),
      nota: textoOuNulo(form.nota),
      valorCentavos: paraCentavos(form.valor),
    };
    const res = linha
      ? await onAtualizar({ id: linha.id, ...dados })
      : await onCriar(dados);
    setPendente(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {linha ? "Editar lançamento" : "Novo lançamento"}
        </DialogTitle>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Campo htmlFor="lc-competencia" label="Competência">
          <input
            id="lc-competencia"
            onChange={(e) => mudar("competencia", e.target.value)}
            style={INPUT}
            type="month"
            value={form.competencia}
          />
        </Campo>
        <Campo htmlFor="lc-data" label="Data">
          <input
            id="lc-data"
            onChange={(e) => mudar("data", e.target.value)}
            style={INPUT}
            type="date"
            value={form.data}
          />
        </Campo>
      </div>

      <Campo htmlFor="lc-conta" label="Conta">
        <select
          id="lc-conta"
          onChange={(e) => mudar("conta", e.target.value)}
          style={INPUT}
          value={form.conta}
        >
          <option value="">Selecione a conta</option>
          {grupos.map(([centro, itens]) => (
            <optgroup key={centro} label={centro}>
              {itens.map((c) => (
                <option key={c.conta} value={c.conta}>
                  {c.conta} · {c.nome}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Campo>

      <Campo htmlFor="lc-descricao" label="Descrição">
        <input
          id="lc-descricao"
          onChange={(e) => mudar("descricao", e.target.value)}
          style={INPUT}
          value={form.descricao}
        />
      </Campo>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Campo
          hint={`grava ${formatarBRL(form.valor.trim() ? paraCentavos(form.valor) : 0)}`}
          htmlFor="lc-valor"
          label="Valor"
        >
          <input
            id="lc-valor"
            inputMode="numeric"
            onChange={(e) => mudar("valor", e.target.value)}
            placeholder="1.234,56"
            style={INPUT}
            value={form.valor}
          />
        </Campo>
        <Campo hint="opcional" htmlFor="lc-contraparte" label="Contraparte">
          <input
            id="lc-contraparte"
            onChange={(e) => mudar("contraparte", e.target.value)}
            style={INPUT}
            value={form.contraparte}
          />
        </Campo>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Campo hint="opcional" htmlFor="lc-documento" label="Documento">
          <input
            id="lc-documento"
            onChange={(e) => mudar("documento", e.target.value)}
            style={INPUT}
            value={form.documento}
          />
        </Campo>
        <Campo hint="opcional" htmlFor="lc-nota" label="Nota">
          <input
            id="lc-nota"
            onChange={(e) => mudar("nota", e.target.value)}
            style={INPUT}
            value={form.nota}
          />
        </Campo>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente || !podeSalvar(form)}
          full={false}
          onClick={salvar}
          type="button"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </BotaoPrimario>
      </div>
    </>
  );
}
