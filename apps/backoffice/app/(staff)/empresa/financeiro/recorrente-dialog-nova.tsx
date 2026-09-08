"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useEffect, useState } from "react";
import { type ClientRow, listClients } from "@/app/actions/clients";
// Só para o `Parameters<typeof criarAssinatura>[0]` abaixo — quem chama a
// action de verdade é `onCriar`, vindo de recorrente.tsx. Mesmo padrão de
// titulo-dialog-novo.tsx.
import type { criarAssinatura } from "@/app/actions/empresa/recorrente";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import { hojeIso } from "@/lib/empresa/periodo";
import type { Result } from "@/lib/safe-action";

/**
 * Diálogo "Nova assinatura" (Task 5, spec 2026-09-06 §4): o quarto diálogo da
 * aba Receita recorrente, separado de recorrente-dialogs.tsx só pelo tamanho
 * — nove campos e um seletor de cliente, mesma razão que separou
 * titulo-dialog-novo.tsx. O seletor de cliente vem de `listClients` (não do
 * payload da aba, que não carrega a base de clientes inteira) e mostra nome e
 * slug, buscado quando o diálogo abre.
 */

type CriarInput = Parameters<typeof criarAssinatura>[0];

const GRID_2 = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "1fr 1fr",
} as const;

type FormNova = {
  clienteSlug: string;
  clienteNome: string;
  planoSlug: string;
  valor: string;
  creditos: string;
  precoCredito: string;
  teto: string;
  iniciouEm: string;
  propostaId: string;
  motivo: string;
};

function formNovaInicial(): FormNova {
  return {
    clienteNome: "",
    clienteSlug: "",
    creditos: "",
    iniciouEm: hojeIso(),
    motivo: "",
    planoSlug: "",
    precoCredito: "",
    propostaId: "",
    teto: "",
    valor: "",
  };
}

function podeSalvarNova(f: FormNova): boolean {
  return (
    f.clienteSlug.length > 0 &&
    f.planoSlug.trim().length > 0 &&
    f.valor.trim().length > 0 &&
    f.creditos.trim().length > 0 &&
    f.precoCredito.trim().length > 0 &&
    f.iniciouEm.length > 0 &&
    f.motivo.trim().length >= 10
  );
}

export function NovaAssinaturaDialog({
  aberto,
  onClose,
  onCriar,
}: {
  aberto: boolean;
  onClose: () => void;
  onCriar: (input: CriarInput) => Promise<Result<{ id: string }>>;
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
        {aberto ? <FormularioNova onClose={onClose} onCriar={onCriar} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function useClientesDoPicker() {
  const [clientes, setClientes] = useState<ClientRow[]>([]);
  useEffect(() => {
    let ativo = true;
    listClients().then((res) => {
      if (ativo && res.ok) {
        setClientes(res.data);
      }
    });
    return () => {
      ativo = false;
    };
  }, []);
  return clientes;
}

function FormularioNova({
  onClose,
  onCriar,
}: {
  onClose: () => void;
  onCriar: (input: CriarInput) => Promise<Result<{ id: string }>>;
}) {
  const [form, setForm] = useState<FormNova>(formNovaInicial);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const clientes = useClientesDoPicker();

  function mudar<K extends keyof FormNova>(campo: K, valor: FormNova[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function selecionarCliente(slug: string) {
    const c = clientes.find((x) => x.slug === slug);
    setForm((f) => ({ ...f, clienteNome: c ? c.name : "", clienteSlug: slug }));
  }

  async function salvar() {
    setErro(null);
    setPendente(true);
    const res = await onCriar({
      clienteNome: form.clienteNome,
      clienteSlug: form.clienteSlug,
      creditosMesIncluidos: Number(form.creditos),
      iniciouEm: form.iniciouEm,
      motivo: form.motivo.trim(),
      planoSlug: form.planoSlug.trim(),
      precoCreditoExtraCentavos: paraCentavos(form.precoCredito),
      propostaId: form.propostaId.trim() === "" ? null : form.propostaId.trim(),
      tetoExcedenteCentavos:
        form.teto.trim() === "" ? null : paraCentavos(form.teto),
      valorMensalCentavos: paraCentavos(form.valor),
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
        <DialogTitle>Nova assinatura</DialogTitle>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <Campo htmlFor="rc-nv-cliente" label="Cliente">
        <select
          id="rc-nv-cliente"
          onChange={(e) => selecionarCliente(e.target.value)}
          style={INPUT}
          value={form.clienteSlug}
        >
          <option value="">Selecione o cliente</option>
          {clientes.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} — {c.slug}
            </option>
          ))}
        </select>
      </Campo>

      <div style={GRID_2}>
        <Campo htmlFor="rc-nv-plano" label="Degrau">
          <input
            id="rc-nv-plano"
            onChange={(e) => mudar("planoSlug", e.target.value)}
            style={INPUT}
            value={form.planoSlug}
          />
        </Campo>
        <Campo
          hint={`grava ${formatarBRL(form.valor.trim() ? paraCentavos(form.valor) : 0)}`}
          htmlFor="rc-nv-valor"
          label="Valor mensal"
        >
          <input
            id="rc-nv-valor"
            inputMode="numeric"
            onChange={(e) => mudar("valor", e.target.value)}
            placeholder="1.234,56"
            style={INPUT}
            value={form.valor}
          />
        </Campo>
      </div>

      <div style={GRID_2}>
        <Campo htmlFor="rc-nv-creditos" label="Créditos incluídos">
          <input
            id="rc-nv-creditos"
            inputMode="numeric"
            onChange={(e) => mudar("creditos", e.target.value)}
            style={INPUT}
            value={form.creditos}
          />
        </Campo>
        <Campo htmlFor="rc-nv-preco-credito" label="Preço do crédito extra">
          <input
            id="rc-nv-preco-credito"
            inputMode="numeric"
            onChange={(e) => mudar("precoCredito", e.target.value)}
            placeholder="1,00"
            style={INPUT}
            value={form.precoCredito}
          />
        </Campo>
      </div>

      <div style={GRID_2}>
        <Campo
          hint="Vazio = sem teto (excedente todo reprimido)."
          htmlFor="rc-nv-teto"
          label="Teto de excedente"
        >
          <input
            id="rc-nv-teto"
            inputMode="numeric"
            onChange={(e) => mudar("teto", e.target.value)}
            placeholder="Sem teto"
            style={INPUT}
            value={form.teto}
          />
        </Campo>
        <Campo htmlFor="rc-nv-inicio" label="Início">
          <input
            id="rc-nv-inicio"
            onChange={(e) => mudar("iniciouEm", e.target.value)}
            style={INPUT}
            type="date"
            value={form.iniciouEm}
          />
        </Campo>
      </div>

      <Campo htmlFor="rc-nv-proposta" label="Proposta (opcional)">
        <input
          id="rc-nv-proposta"
          onChange={(e) => mudar("propostaId", e.target.value)}
          style={INPUT}
          value={form.propostaId}
        />
      </Campo>

      <Campo
        hint="Pelo menos 10 caracteres."
        htmlFor="rc-nv-motivo"
        label="Motivo"
      >
        <input
          id="rc-nv-motivo"
          onChange={(e) => mudar("motivo", e.target.value)}
          style={INPUT}
          value={form.motivo}
        />
      </Campo>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente || !podeSalvarNova(form)}
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
