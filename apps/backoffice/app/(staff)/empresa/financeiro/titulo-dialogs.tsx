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
// verdade é `onBaixar`/`onCancelar`, vindos de titulos.tsx. Mesmo padrão de
// lancamento-dialog.tsx.
import type {
  baixarTitulo,
  cancelarTitulo,
} from "@/app/actions/empresa/titulos";
import { Campo, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import {
  EXPLICACAO_DO_DIALOGO,
  PerguntaDescartar,
  rascunhoMudou,
  useFecharComRascunho,
  useRascunhoReportado,
} from "@/components/pergunta-descartar";
import { formatarBRL } from "@/lib/comercial/formato";
import type { TituloRow } from "@/lib/empresa/livro";
import {
  competenciaAtual,
  formatarDataBr,
  hojeIso,
} from "@/lib/empresa/periodo";
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
  // Esc, clique fora e X chegam aqui; com rascunho, a guarda pergunta antes.
  const guarda = useFecharComRascunho(onClose);
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          guarda.pedirFechar();
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
        {guarda.perguntando ? (
          <PerguntaDescartar
            explicacao={EXPLICACAO_DO_DIALOGO}
            onDescartar={guarda.descartar}
            onVoltar={guarda.voltar}
          />
        ) : null}
        {titulo ? (
          <FormularioBaixar
            key={titulo.id}
            marcarSujo={guarda.marcarSujo}
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
  marcarSujo,
  onClose,
  onBaixar,
}: {
  titulo: TituloRow;
  marcarSujo: (sujo: boolean) => void;
  onClose: () => void;
  onBaixar: (input: BaixarInput) => Promise<Result<{ id: string }>>;
}) {
  // O inicial guardado: `formBaixarInicial()` lê o relógio, e o rascunho é a
  // diferença para o que nasceu, não para "agora".
  const [inicial] = useState<FormBaixar>(formBaixarInicial);
  const [form, setForm] = useState<FormBaixar>(inicial);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useRascunhoReportado(rascunhoMudou(form, inicial), marcarSujo);
  const mesDivergente = form.data.slice(0, 7) !== form.competencia;
  const incompleto = form.data === "" || form.competencia === "";

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
        <DialogTitle style={{ fontSize: "var(--fs-forte)" }}>
          Baixar título — {titulo.descricao}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Marca o título como pago ou recebido numa data e competência, e gera o
          lançamento no livro.
        </DialogDescription>
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

      {/* Barreira: baixar grava um lançamento no livro na mesma transação
          (`baixarTitulo`), e não há action que desfaça — só um estorno lançado
          à mão. Cancelar já passava por aqui; baixar era um botão só. */}
      <ConfirmarAcao
        alvo={`${titulo.descricao} · ${formatarBRL(titulo.valorCentavos)}`}
        consequencia={`Grava um lançamento de ${formatarBRL(titulo.valorCentavos)} no livro em ${formatarDataBr(form.data)}, competência ${form.competencia}; a baixa não se desfaz — para corrigir, lança-se o estorno à mão.`}
        desabilitado={incompleto}
        executando={pendente}
        onConfirmar={confirmar}
        rotulo="Confirmar baixa"
        tom="accent"
      />
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
  // Esc, clique fora e X chegam aqui; com rascunho, a guarda pergunta antes.
  const guarda = useFecharComRascunho(onClose);
  return (
    <Dialog
      onOpenChange={(v) => {
        if (!v) {
          guarda.pedirFechar();
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
        {guarda.perguntando ? (
          <PerguntaDescartar
            explicacao={EXPLICACAO_DO_DIALOGO}
            onDescartar={guarda.descartar}
            onVoltar={guarda.voltar}
          />
        ) : null}
        {titulo ? (
          <FormularioCancelar
            key={titulo.id}
            marcarSujo={guarda.marcarSujo}
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
  marcarSujo,
  onClose,
  onCancelar,
}: {
  titulo: TituloRow;
  marcarSujo: (sujo: boolean) => void;
  onClose: () => void;
  onCancelar: (input: CancelarInput) => Promise<Result<{ id: string }>>;
}) {
  const [motivo, setMotivo] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useRascunhoReportado(motivo.trim() !== "", marcarSujo);

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
        <DialogTitle style={{ fontSize: "var(--fs-forte)" }}>
          Cancelar título — {titulo.descricao}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Cancela o título em aberto com um motivo. Ele sai do que está a vencer
          e não gera lançamento.
        </DialogDescription>
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
