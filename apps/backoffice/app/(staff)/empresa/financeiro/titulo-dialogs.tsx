"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";
// Só para os `Parameters<typeof ...>[0]` abaixo — quem chama a action de
// verdade é `onBaixar`/`onCancelar`, vindos de titulos.tsx. Mesmo padrão de
// lancamento-dialog.tsx.
import type {
  baixarTitulo,
  cancelarTitulo,
} from "@/app/actions/empresa/titulos";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import type { TituloRow } from "@/lib/empresa/livro";
import { competenciaAtual, hojeIso } from "@/lib/empresa/periodo";
import type { Result } from "@/lib/safe-action";

/**
 * Dois dos três diálogos da aba Títulos (Task 6, spec 2026-09-06 §4): baixar
 * e cancelar — o terceiro, criar, mora em titulo-dialog-novo.tsx, separado só
 * pelo tamanho (sete campos contra dois). Corpo desmontado quando não há
 * título selecionado, mesma regra de `lancamento-dialog.tsx` — sem isso o
 * `useState` de rascunho vazaria de um título para o próximo.
 *
 * `Aviso` e `GRID_2` são exportados daqui porque os três diálogos os usam;
 * `hojeIso`/`competenciaAtual` vêm de lib/empresa/periodo.ts (cópia única,
 * fix-wave D2) e cada arquivo os importa de lá direto.
 */

type BaixarInput = Parameters<typeof baixarTitulo>[0];
type CancelarInput = Parameters<typeof cancelarTitulo>[0];

export const GRID_2 = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "1fr 1fr",
};

/** Aviso não bloqueante (âmbar) — diferente de `Erro`: nada quebrou, é só a
 *  pessoa conferir antes de seguir. Mesmos tokens de clientes/novo/form.tsx. */
export function Aviso({ children }: { children: string }) {
  return (
    <p
      style={{
        background: "var(--amber-soft)",
        border: "1px solid rgba(var(--amber-rgb),.35)",
        borderRadius: "var(--r-md)",
        color: "var(--amber-text)",
        fontSize: "var(--fs-base)",
        fontWeight: 600,
        margin: 0,
        padding: "9px 11px",
      }}
    >
      {children}
    </p>
  );
}

// ── Baixar ──

type FormBaixar = { data: string; competencia: string };

function formBaixarInicial(): FormBaixar {
  return { competencia: competenciaAtual(), data: hojeIso() };
}

export function BaixarDialog({
  titulo,
  onClose,
  onBaixar,
}: {
  /** Título sendo baixado — `null` fecha o diálogo. O `open` do `Dialog`
   *  deriva daqui: não há um `aberto` separado para não abrir um diálogo sem
   *  título nenhum para mostrar. */
  titulo: TituloRow | null;
  onClose: () => void;
  onBaixar: (input: BaixarInput) => Promise<Result<{ id: string }>>;
}) {
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          onClose();
        }
      }}
      open={titulo !== null}
    >
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
          color: "var(--ink)",
        }}
      >
        {titulo ? (
          <FormularioBaixar
            key={titulo.id}
            onBaixar={onBaixar}
            onClose={onClose}
            titulo={titulo}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormularioBaixar({
  titulo,
  onClose,
  onBaixar,
}: {
  titulo: TituloRow;
  onClose: () => void;
  onBaixar: (input: BaixarInput) => Promise<Result<{ id: string }>>;
}) {
  const [form, setForm] = useState<FormBaixar>(formBaixarInicial);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mesDivergente = form.data.slice(0, 7) !== form.competencia;

  async function confirmar() {
    setErro(null);
    setPendente(true);
    const res = await onBaixar({
      competencia: form.competencia,
      data: form.data,
      id: titulo.id,
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
        <DialogTitle>Baixar título — {titulo.descricao}</DialogTitle>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}
      {mesDivergente ? (
        <Aviso>Data e competência em meses diferentes</Aviso>
      ) : null}

      <div style={GRID_2}>
        <Campo htmlFor="tt-baixa-data" label="Data">
          <input
            id="tt-baixa-data"
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
            style={INPUT}
            type="date"
            value={form.data}
          />
        </Campo>
        <Campo htmlFor="tt-baixa-competencia" label="Competência">
          <input
            id="tt-baixa-competencia"
            onChange={(e) =>
              setForm((f) => ({ ...f, competencia: e.target.value }))
            }
            style={INPUT}
            type="month"
            value={form.competencia}
          />
        </Campo>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente}
          full={false}
          onClick={confirmar}
          type="button"
        >
          {pendente ? "Baixando…" : "Confirmar baixa"}
        </BotaoPrimario>
      </div>
    </>
  );
}

// ── Cancelar ──

function podeConfirmarCancelamento(motivo: string): boolean {
  return motivo.trim().length >= 10;
}

export function CancelarDialog({
  titulo,
  onClose,
  onCancelar,
}: {
  /** Título sendo cancelado — `null` fecha o diálogo. Mesmo raciocínio de
   *  `BaixarDialog`: o `open` deriva daqui, sem um `aberto` redundante. */
  titulo: TituloRow | null;
  onClose: () => void;
  onCancelar: (input: CancelarInput) => Promise<Result<{ id: string }>>;
}) {
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          onClose();
        }
      }}
      open={titulo !== null}
    >
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
          color: "var(--ink)",
        }}
      >
        {titulo ? (
          <FormularioCancelar
            key={titulo.id}
            onCancelar={onCancelar}
            onClose={onClose}
            titulo={titulo}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormularioCancelar({
  titulo,
  onClose,
  onCancelar,
}: {
  titulo: TituloRow;
  onClose: () => void;
  onCancelar: (input: CancelarInput) => Promise<Result<{ id: string }>>;
}) {
  const [motivo, setMotivo] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar() {
    setErro(null);
    setPendente(true);
    const res = await onCancelar({ id: titulo.id, motivo: motivo.trim() });
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
        <DialogTitle>Cancelar título — {titulo.descricao}</DialogTitle>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <Campo
        hint="Pelo menos 10 caracteres."
        htmlFor="tt-motivo"
        label="Motivo do cancelamento"
      >
        <input
          id="tt-motivo"
          onChange={(e) => setMotivo(e.target.value)}
          style={INPUT}
          value={motivo}
        />
      </Campo>

      <ConfirmarAcao
        alvo={titulo.descricao}
        consequencia="O título sai da lista de abertos e não pode ser reaberto."
        desabilitado={!podeConfirmarCancelamento(motivo)}
        executando={pendente}
        onConfirmar={cancelar}
        rotulo="Cancelar título"
      />
    </>
  );
}
