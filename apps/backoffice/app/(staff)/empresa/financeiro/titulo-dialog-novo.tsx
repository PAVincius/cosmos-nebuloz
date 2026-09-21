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
// Só para o `Parameters<typeof criarTitulo>[0]` abaixo — mesmo padrão de
// titulo-dialogs.tsx.
import type { criarTitulo } from "@/app/actions/empresa/titulos";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import {
  EXPLICACAO_DO_DIALOGO,
  PerguntaDescartar,
  rascunhoMudou,
  useFecharComRascunho,
  useRascunhoReportado,
} from "@/components/pergunta-descartar";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import { ROTULO_TIPO, type TituloRow } from "@/lib/empresa/livro";
import { hojeIso } from "@/lib/empresa/periodo";
import type { Result } from "@/lib/safe-action";
import { Aviso } from "./titulo-dialogs";

/**
 * Diálogo "Novo título" (Task 6, spec 2026-09-06 §4). Separado dos outros
 * dois — Baixar e Cancelar, em titulo-dialogs.tsx — só pelo tamanho: sete
 * campos contra dois, e juntos os três passariam do teto de ~400 linhas do
 * lint num arquivo só. `Aviso` é de lá; `hojeIso` é a cópia
 * única de lib/empresa/periodo.ts (fix-wave D2).
 */

type CriarInput = Parameters<typeof criarTitulo>[0];

type FormNovo = {
  tipo: TituloRow["tipo"] | "";
  descricao: string;
  contraparte: string;
  conta: string;
  valor: string;
  emissao: string;
  vencimento: string;
};

function formNovoInicial(): FormNovo {
  const hoje = hojeIso();
  return {
    conta: "",
    contraparte: "",
    descricao: "",
    emissao: hoje,
    tipo: "",
    valor: "",
    vencimento: hoje,
  };
}

function podeSalvarNovo(f: FormNovo): boolean {
  return (
    f.tipo !== "" &&
    f.descricao.trim().length > 0 &&
    f.contraparte.trim().length > 0 &&
    f.conta.length > 0 &&
    f.valor.trim().length > 0 &&
    f.emissao.length > 0 &&
    f.vencimento.length > 0 &&
    f.vencimento >= f.emissao
  );
}

export function NovoTituloDialog({
  aberto,
  contas,
  onClose,
  onCriar,
}: {
  aberto: boolean;
  contas: ContaView[];
  onClose: () => void;
  onCriar: (input: CriarInput) => Promise<Result<{ id: string }>>;
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
          <FormularioNovo
            contas={contas}
            marcarSujo={guarda.marcarSujo}
            onClose={onClose}
            onCriar={onCriar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormularioNovo({
  contas,
  marcarSujo,
  onClose,
  onCriar,
}: {
  contas: ContaView[];
  marcarSujo: (sujo: boolean) => void;
  onClose: () => void;
  onCriar: (input: CriarInput) => Promise<Result<{ id: string }>>;
}) {
  const [form, setForm] = useState<FormNovo>(formNovoInicial);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useRascunhoReportado(rascunhoMudou(form, formNovoInicial()), marcarSujo);
  const contasAtivas = contas.filter((c) => c.ativa);
  const vencimentoInvalido =
    form.emissao.length > 0 &&
    form.vencimento.length > 0 &&
    form.vencimento < form.emissao;

  function mudar<K extends keyof FormNovo>(campo: K, valor: FormNovo[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    setErro(null);
    setPendente(true);
    const res = await onCriar({
      conta: form.conta,
      contraparte: form.contraparte.trim(),
      descricao: form.descricao.trim(),
      emissao: form.emissao,
      tipo: form.tipo as TituloRow["tipo"],
      valorCentavos: paraCentavos(form.valor),
      vencimento: form.vencimento,
    });
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
          Novo título
        </DialogTitle>
        <DialogDescription className="sr-only">
          Lança um título a pagar ou a receber, com contraparte, conta, emissão
          e vencimento.
        </DialogDescription>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}
      {vencimentoInvalido ? (
        <Aviso>Vencimento não pode ser antes da emissão.</Aviso>
      ) : null}

      <div className="bo-duas-colunas">
        <Campo htmlFor="tt-tipo" label="Tipo">
          <select
            id="tt-tipo"
            onChange={(e) => mudar("tipo", e.target.value as FormNovo["tipo"])}
            style={INPUT}
            value={form.tipo}
          >
            <option value="">Selecione</option>
            <option value="PAGAR">{ROTULO_TIPO.PAGAR}</option>
            <option value="RECEBER">{ROTULO_TIPO.RECEBER}</option>
          </select>
        </Campo>
        <Campo htmlFor="tt-conta" label="Conta">
          <select
            id="tt-conta"
            onChange={(e) => mudar("conta", e.target.value)}
            style={INPUT}
            value={form.conta}
          >
            <option value="">Selecione a conta</option>
            {contasAtivas.map((c) => (
              <option key={c.conta} value={c.conta}>
                {c.conta} · {c.nome}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo htmlFor="tt-descricao" label="Descrição">
        <input
          id="tt-descricao"
          onChange={(e) => mudar("descricao", e.target.value)}
          style={INPUT}
          value={form.descricao}
        />
      </Campo>

      <Campo htmlFor="tt-contraparte" label="Contraparte">
        <input
          id="tt-contraparte"
          onChange={(e) => mudar("contraparte", e.target.value)}
          style={INPUT}
          value={form.contraparte}
        />
      </Campo>

      <Campo
        hint={`grava ${formatarBRL(form.valor.trim() ? paraCentavos(form.valor) : 0)}`}
        htmlFor="tt-valor"
        label="Valor"
      >
        <input
          id="tt-valor"
          inputMode="numeric"
          onChange={(e) => mudar("valor", e.target.value)}
          placeholder="1.234,56"
          style={INPUT}
          value={form.valor}
        />
      </Campo>

      <div className="bo-duas-colunas">
        <Campo htmlFor="tt-emissao" label="Emissão">
          <input
            id="tt-emissao"
            onChange={(e) => mudar("emissao", e.target.value)}
            style={INPUT}
            type="date"
            value={form.emissao}
          />
        </Campo>
        <Campo htmlFor="tt-vencimento" label="Vencimento">
          <input
            id="tt-vencimento"
            onChange={(e) => mudar("vencimento", e.target.value)}
            style={INPUT}
            type="date"
            value={form.vencimento}
          />
        </Campo>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente || !podeSalvarNovo(form)}
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
