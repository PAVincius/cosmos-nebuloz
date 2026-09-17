"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  EXPLICACAO_DO_DIALOGO,
  PerguntaDescartar,
  rascunhoMudou,
  useFecharComRascunho,
  useRascunhoReportado,
} from "@/components/pergunta-descartar";
import {
  centavosParaCampo,
  formatarBRL,
  paraCentavos,
} from "@/lib/comercial/formato";
import type { LinhaDoLivro } from "@/lib/empresa/livro";
import { competenciaAtual, hojeIso } from "@/lib/empresa/periodo";
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
      valor: centavosParaCampo(linha.valorCentavos),
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

/** O `LancamentoSchema` atual exige `valorCentavos > 0`; o modelo antigo
 *  (`LancamentoMensal`) não exigia, então a migração pode ter copiado linha
 *  com valor zero ou negativo. Editar essa linha sem trocar o valor já seria
 *  recusado pelo schema — aqui a recusa é explícita, antes de ir ao servidor,
 *  porque "Valor tem que ser maior que zero" sozinho não explica por que uma
 *  linha existente ficou assim nem o que fazer a respeito. */
const VALOR_MIGRADO_INVALIDO =
  "Esta linha veio do livro-razão antigo com valor zero ou negativo, que o modelo atual não aceita. Exclua-a (se não vier de título) e recrie o lançamento com o valor correto.";

function linhaMigradaInvalida(linha: LinhaDoLivro | null): boolean {
  return linha !== null && linha.valorCentavos <= 0;
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
  // Esc, clique fora e X chegam aqui; com rascunho, a guarda pergunta antes.
  const guarda = useFecharComRascunho(onClose);
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          guarda.pedirFechar();
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
        {guarda.perguntando ? (
          <PerguntaDescartar
            explicacao={EXPLICACAO_DO_DIALOGO}
            onDescartar={guarda.descartar}
            onVoltar={guarda.voltar}
          />
        ) : null}
        {aberto ? (
          <Formulario
            contas={contas}
            linha={linha}
            marcarSujo={guarda.marcarSujo}
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
  marcarSujo,
  onClose,
  onCriar,
  onAtualizar,
}: {
  linha: LinhaDoLivro | null;
  contas: ContaView[];
  marcarSujo: (sujo: boolean) => void;
  onClose: () => void;
  onCriar: (input: CriarInput) => Promise<Result<{ id: string }>>;
  onAtualizar: (input: AtualizarInput) => Promise<Result<{ id: string }>>;
}) {
  const [form, setForm] = useState<FormLancamento>(() => formInicial(linha));
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useRascunhoReportado(rascunhoMudou(form, formInicial(linha)), marcarSujo);
  const grupos = agruparPorCentro(contas.filter((c) => c.ativa));
  const migradaInvalida = linhaMigradaInvalida(linha);
  // Fora do JSX por causa do noLeakedRender: `migradaInvalida && !erro` como
  // condição de `? :` direto no corpo do componente é lido como um `&&` de
  // render pelo linter, mesmo os dois lados sendo booleanos.
  const mostrarAvisoMigrada = migradaInvalida && !erro;

  function mudar<K extends keyof FormLancamento>(
    campo: K,
    valor: FormLancamento[K]
  ) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    if (migradaInvalida) {
      setErro(VALOR_MIGRADO_INVALIDO);
      return;
    }
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
        <DialogTitle style={{ fontSize: "var(--fs-forte)" }}>
          {linha ? "Editar lançamento" : "Novo lançamento"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {linha
            ? "Altera competência, data, conta, descrição e valor deste lançamento do livro."
            : "Registra um lançamento no livro, com competência, data, conta, descrição e valor."}
        </DialogDescription>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}
      {mostrarAvisoMigrada ? <Erro>{VALOR_MIGRADO_INVALIDO}</Erro> : null}

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
          disabled={pendente || !podeSalvar(form) || migradaInvalida}
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
