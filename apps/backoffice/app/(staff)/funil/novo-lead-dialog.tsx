"use client";

import type { ProductModule } from "@repo/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
// `criarLead` só entra aqui para o `Parameters<typeof criarLead>[0]` abaixo —
// quem chama a action de fato é `onCriar`, vindo de funil.tsx.
import type { CanalRow, criarLead } from "@/app/actions/leads";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import { PORTAS } from "@/lib/comercial/funil";
import type { Result } from "@/lib/safe-action";

/**
 * Diálogo de novo lead (spec §4, design `NewLeadModal` de
 * backoffice-funnel.jsx). Nasce em LEAD — dono e histórico são
 * responsabilidade da action, não deste formulário.
 */

const PORTA_INICIAL = (Object.keys(PORTAS) as ProductModule[])[0];

type FormNovoLead = {
  nome: string;
  contatoNome: string;
  contatoEmail: string;
  entrada: ProductModule;
  canalSlug: string;
  acv: string;
  proximaAcao: string;
  proximaAcaoEm: string;
};

function formInicial(canais: CanalRow[]): FormNovoLead {
  return {
    nome: "",
    contatoNome: "",
    contatoEmail: "",
    entrada: PORTA_INICIAL,
    canalSlug: canais[0]?.slug ?? "",
    acv: "",
    proximaAcao: "",
    proximaAcaoEm: "",
  };
}

function podeCriar(f: FormNovoLead): boolean {
  return (
    f.nome.trim().length >= 2 &&
    f.proximaAcao.trim().length > 0 &&
    f.proximaAcaoEm.length > 0
  );
}

type CriarLeadInput = Parameters<typeof criarLead>[0];

export function NovoLeadDialog({
  aberto,
  canais,
  onClose,
  onCriar,
}: {
  aberto: boolean;
  canais: CanalRow[];
  onClose: () => void;
  onCriar: (input: CriarLeadInput) => Promise<Result<{ id: string }>>;
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
        className="sm:max-w-2xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
          color: "var(--ink)",
        }}
      >
        {aberto ? (
          <Formulario canais={canais} onClose={onClose} onCriar={onCriar} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function estiloChip(ativo: boolean): CSSProperties {
  return {
    padding: "5px 11px",
    borderRadius: 99,
    fontSize: "var(--fs-nota)",
    fontWeight: 700,
    fontFamily: "inherit",
    cursor: "pointer",
    background: ativo ? "var(--accent-soft)" : "var(--surface-2)",
    border: `1px solid ${ativo ? "rgba(var(--accent-rgb),.45)" : "var(--hairline)"}`,
    color: ativo ? "var(--accent-text)" : "var(--ink-muted)",
  };
}

/** Grupo de chips com rótulo — `fieldset`/`legend`, não `Campo`: nenhum chip
 *  é um controle único que um `htmlFor` possa apontar. */
function GrupoChips({
  titulo,
  dica,
  children,
}: {
  titulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <fieldset
      style={{
        margin: 0,
        padding: 0,
        border: "none",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <legend
        className="mono"
        style={{
          padding: 0,
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {titulo}
      </legend>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {children}
      </div>
      {dica ? (
        <span
          style={{
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
            fontWeight: 500,
          }}
        >
          {dica}
        </span>
      ) : null}
    </fieldset>
  );
}

function Formulario({
  canais,
  onClose,
  onCriar,
}: {
  canais: CanalRow[];
  onClose: () => void;
  onCriar: (input: CriarLeadInput) => Promise<Result<{ id: string }>>;
}) {
  const [form, setForm] = useState<FormNovoLead>(() => formInicial(canais));
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function mudar<K extends keyof FormNovoLead>(
    campo: K,
    valor: FormNovoLead[K]
  ) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function criar() {
    setErro(null);
    setPendente(true);
    const res = await onCriar({
      nome: form.nome.trim(),
      contatoNome: form.contatoNome.trim() || undefined,
      contatoEmail: form.contatoEmail.trim() || undefined,
      entrada: form.entrada,
      canalSlug: form.canalSlug,
      acvEstimadoCentavos: form.acv.trim() ? paraCentavos(form.acv) : undefined,
      proximaAcao: form.proximaAcao.trim(),
      proximaAcaoEm: form.proximaAcaoEm,
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
        <DialogTitle>Novo lead</DialogTitle>
        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          Nasce em Lead, com dono, porta de entrada e um próximo passo datado.
        </span>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Campo htmlFor="nl-nome" label="Organização">
          <input
            id="nl-nome"
            onChange={(e) => mudar("nome", e.target.value)}
            style={INPUT}
            value={form.nome}
          />
        </Campo>
        <Campo hint="opcional" htmlFor="nl-contato" label="Contato">
          <input
            id="nl-contato"
            onChange={(e) => mudar("contatoNome", e.target.value)}
            style={INPUT}
            value={form.contatoNome}
          />
        </Campo>
        <Campo hint="opcional" htmlFor="nl-email" label="E-mail">
          <input
            id="nl-email"
            onChange={(e) => mudar("contatoEmail", e.target.value)}
            style={INPUT}
            type="email"
            value={form.contatoEmail}
          />
        </Campo>
        <Campo
          hint={`grava ${formatarBRL(form.acv.trim() ? paraCentavos(form.acv) : 0)} · peso 10% no lead`}
          htmlFor="nl-acv"
          label="ACV estimado"
        >
          <input
            id="nl-acv"
            inputMode="numeric"
            onChange={(e) => mudar("acv", e.target.value)}
            placeholder="50.000,00"
            style={INPUT}
            value={form.acv}
          />
        </Campo>
      </div>

      <GrupoChips
        dica="O CTA é sempre o assessment. Entrar por outro degrau é exceção que se mede."
        titulo="Porta de entrada na Escada"
      >
        {(Object.keys(PORTAS) as ProductModule[]).map((chave) => {
          const porta = PORTAS[chave];
          return (
            <button
              aria-pressed={form.entrada === chave}
              key={chave}
              onClick={() => mudar("entrada", chave)}
              style={estiloChip(form.entrada === chave)}
              type="button"
            >
              {porta.degrau} {porta.rotulo}
            </button>
          );
        })}
      </GrupoChips>

      <GrupoChips
        dica="Cada canal carrega seu custo médio — é isso que vira CAC."
        titulo="Origem"
      >
        {canais.map((c) => (
          <button
            aria-pressed={form.canalSlug === c.slug}
            key={c.slug}
            onClick={() => mudar("canalSlug", c.slug)}
            style={estiloChip(form.canalSlug === c.slug)}
            type="button"
          >
            {c.nome}
            {c.cacMedioCentavos === null
              ? ""
              : ` · CAC ${formatarBRL(c.cacMedioCentavos)}`}
          </button>
        ))}
      </GrupoChips>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Campo htmlFor="nl-passo" label="Próximo passo">
          <input
            id="nl-passo"
            onChange={(e) => mudar("proximaAcao", e.target.value)}
            style={INPUT}
            value={form.proximaAcao}
          />
        </Campo>
        <Campo htmlFor="nl-data" label="Quando">
          <input
            id="nl-data"
            onChange={(e) => mudar("proximaAcaoEm", e.target.value)}
            style={INPUT}
            type="date"
            value={form.proximaAcaoEm}
          />
        </Campo>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente || !podeCriar(form)}
          full={false}
          onClick={criar}
          type="button"
        >
          {pendente ? "Criando…" : "Criar lead"}
        </BotaoPrimario>
      </div>
    </>
  );
}
