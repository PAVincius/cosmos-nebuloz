"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";
// Só para os `Parameters<typeof ...>[0]` abaixo — quem chama a action de
// verdade é `onAlterar`/`onEncerrar`/`onSalvar`, vindos de recorrente.tsx.
// Mesmo padrão de titulo-dialogs.tsx.
import type {
  alterarValor,
  encerrarAssinatura,
  salvarCreditoDoMes,
} from "@/app/actions/empresa/recorrente";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import { hojeIso } from "@/lib/empresa/periodo";
import type { AssinaturaRow } from "@/lib/empresa/recorrente";
import type { Result } from "@/lib/safe-action";

/**
 * Três dos quatro diálogos da aba Receita recorrente (Task 5, spec
 * 2026-09-06 §4): alterar valor, encerrar e lançar consumo do mês — o quarto,
 * criar assinatura, mora em recorrente-dialog-nova.tsx, separado só pelo
 * tamanho (nove campos e um seletor de cliente contra dois ou três), mesma
 * razão que separou titulo-dialog-novo.tsx de titulo-dialogs.tsx. Corpo
 * desmontado quando não há assinatura selecionada — sem isso o `useState` de
 * rascunho vazaria de uma assinatura para a próxima.
 */

type AlterarInput = Parameters<typeof alterarValor>[0];
type EncerrarInput = Parameters<typeof encerrarAssinatura>[0];
type CreditoInput = Parameters<typeof salvarCreditoDoMes>[0];

const ESTILO_DIALOGO = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  color: "var(--ink)",
} as const;

// ── Alterar valor ──

type FormAlterar = { valor: string; motivo: string; competencia: string };

function formAlterarInicial(competencia: string): FormAlterar {
  return { competencia, motivo: "", valor: "" };
}

function podeSalvarAlterar(f: FormAlterar): boolean {
  return (
    f.valor.trim().length > 0 &&
    f.competencia.length > 0 &&
    f.motivo.trim().length >= 10
  );
}

export function AlterarValorDialog({
  assinatura,
  competencia,
  onClose,
  onAlterar,
}: {
  /** Assinatura sendo alterada — `null` fecha o diálogo. */
  assinatura: AssinaturaRow | null;
  /** Competência da aba, usada como valor inicial do campo — a pessoa pode
   *  trocar para gravar a mudança numa competência diferente da que está
   *  olhando. */
  competencia: string;
  onClose: () => void;
  onAlterar: (input: AlterarInput) => Promise<Result<{ id: string }>>;
}) {
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          onClose();
        }
      }}
      open={assinatura !== null}
    >
      <DialogContent className="sm:max-w-md" style={ESTILO_DIALOGO}>
        {assinatura ? (
          <FormularioAlterar
            assinatura={assinatura}
            competenciaInicial={competencia}
            key={assinatura.id}
            onAlterar={onAlterar}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormularioAlterar({
  assinatura,
  competenciaInicial,
  onClose,
  onAlterar,
}: {
  assinatura: AssinaturaRow;
  competenciaInicial: string;
  onClose: () => void;
  onAlterar: (input: AlterarInput) => Promise<Result<{ id: string }>>;
}) {
  const [form, setForm] = useState<FormAlterar>(() =>
    formAlterarInicial(competenciaInicial)
  );
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setPendente(true);
    const res = await onAlterar({
      competencia: form.competencia,
      id: assinatura.id,
      motivo: form.motivo.trim(),
      valorCentavos: paraCentavos(form.valor),
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
          Alterar valor — {assinatura.clienteNome}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Grava um novo valor mensal para a assinatura a partir de uma
          competência, com o motivo da mudança.
        </DialogDescription>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <Campo
        hint={`Valor atual: ${formatarBRL(assinatura.valorMensalCentavos)}`}
        htmlFor="rc-alt-valor"
        label="Novo valor mensal"
      >
        <input
          id="rc-alt-valor"
          inputMode="numeric"
          onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
          placeholder="1.234,56"
          style={INPUT}
          value={form.valor}
        />
      </Campo>

      <Campo htmlFor="rc-alt-competencia" label="Competência">
        <input
          id="rc-alt-competencia"
          onChange={(e) =>
            setForm((f) => ({ ...f, competencia: e.target.value }))
          }
          style={INPUT}
          type="month"
          value={form.competencia}
        />
      </Campo>

      <Campo
        hint="Pelo menos 10 caracteres."
        htmlFor="rc-alt-motivo"
        label="Motivo"
      >
        <input
          id="rc-alt-motivo"
          onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
          style={INPUT}
          value={form.motivo}
        />
      </Campo>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente || !podeSalvarAlterar(form)}
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

// ── Encerrar ──

function podeConfirmarEncerramento(motivo: string): boolean {
  return motivo.trim().length >= 10;
}

export function EncerrarDialog({
  assinatura,
  onClose,
  onEncerrar,
}: {
  assinatura: AssinaturaRow | null;
  onClose: () => void;
  onEncerrar: (input: EncerrarInput) => Promise<Result<{ id: string }>>;
}) {
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          onClose();
        }
      }}
      open={assinatura !== null}
    >
      <DialogContent className="sm:max-w-md" style={ESTILO_DIALOGO}>
        {assinatura ? (
          <FormularioEncerrar
            assinatura={assinatura}
            key={assinatura.id}
            onClose={onClose}
            onEncerrar={onEncerrar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormularioEncerrar({
  assinatura,
  onClose,
  onEncerrar,
}: {
  assinatura: AssinaturaRow;
  onClose: () => void;
  onEncerrar: (input: EncerrarInput) => Promise<Result<{ id: string }>>;
}) {
  const [data, setData] = useState(hojeIso);
  const [motivo, setMotivo] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function encerrar() {
    setErro(null);
    setPendente(true);
    const res = await onEncerrar({
      data,
      id: assinatura.id,
      motivo: motivo.trim(),
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
          Encerrar assinatura — {assinatura.clienteNome}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Encerra a assinatura numa data, com o motivo. A partir dali ela deixa
          de contar na receita recorrente.
        </DialogDescription>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <Campo htmlFor="rc-enc-data" label="Data do encerramento">
        <input
          id="rc-enc-data"
          onChange={(e) => setData(e.target.value)}
          style={INPUT}
          type="date"
          value={data}
        />
      </Campo>

      <Campo
        hint="Pelo menos 10 caracteres."
        htmlFor="rc-enc-motivo"
        label="Motivo"
      >
        <input
          id="rc-enc-motivo"
          onChange={(e) => setMotivo(e.target.value)}
          style={INPUT}
          value={motivo}
        />
      </Campo>

      <ConfirmarAcao
        alvo={assinatura.clienteNome}
        consequencia="Sai do MRR já na competência do encerramento."
        desabilitado={!podeConfirmarEncerramento(motivo)}
        executando={pendente}
        onConfirmar={encerrar}
        rotulo="Encerrar assinatura"
      />
    </>
  );
}

// ── Lançar consumo do mês ──

function podeSalvarCredito(consumidos: string): boolean {
  if (consumidos.trim().length === 0) {
    return false;
  }
  const n = Number(consumidos);
  return Number.isInteger(n) && n >= 0;
}

export function CreditoDialog({
  assinatura,
  competencia,
  onClose,
  onSalvar,
}: {
  assinatura: AssinaturaRow | null;
  competencia: string;
  onClose: () => void;
  onSalvar: (
    input: CreditoInput
  ) => Promise<Result<{ clienteSlug: string; competencia: string }>>;
}) {
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          onClose();
        }
      }}
      open={assinatura !== null}
    >
      <DialogContent className="sm:max-w-sm" style={ESTILO_DIALOGO}>
        {assinatura ? (
          <FormularioCredito
            assinatura={assinatura}
            competencia={competencia}
            key={assinatura.id}
            onClose={onClose}
            onSalvar={onSalvar}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormularioCredito({
  assinatura,
  competencia,
  onClose,
  onSalvar,
}: {
  assinatura: AssinaturaRow;
  competencia: string;
  onClose: () => void;
  onSalvar: (
    input: CreditoInput
  ) => Promise<Result<{ clienteSlug: string; competencia: string }>>;
}) {
  const [consumidos, setConsumidos] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setPendente(true);
    const res = await onSalvar({
      clienteSlug: assinatura.clienteSlug,
      competencia,
      consumidos: Number(consumidos),
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
          Consumo do mês — {assinatura.clienteNome}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Registra os créditos consumidos na competência; o que passar da
          franquia vira excedente cobrado.
        </DialogDescription>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <Campo
        hint={`Franquia do contrato: ${assinatura.creditosMesIncluidos} créditos.`}
        htmlFor="rc-cred-consumidos"
        label="Créditos consumidos no mês"
      >
        <input
          id="rc-cred-consumidos"
          inputMode="numeric"
          onChange={(e) => setConsumidos(e.target.value)}
          style={INPUT}
          value={consumidos}
        />
      </Campo>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente || !podeSalvarCredito(consumidos)}
          full={false}
          onClick={salvar}
          type="button"
        >
          {pendente ? "Salvando…" : "Salvar consumo"}
        </BotaoPrimario>
      </div>
    </>
  );
}
