"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";
import type { LeadRow } from "@/app/actions/leads";
import { Erro } from "@/components/campo";
import {
  type ConfigEstagio,
  diasNoEstagio,
  type Estagio,
  estagnado,
  type LeadFunil,
  type MotivoPerda,
  proximoEstagio,
} from "@/lib/comercial/funil";
import type { Result } from "@/lib/safe-action";
import {
  BlocoFechado,
  BlocoProposta,
  BlocoProximoPasso,
  CartoesResumo,
  ModoPerda,
  RodapeLeadDialog,
  Stepper,
} from "./lead-dialog-partes";

/**
 * Diálogo do lead (spec §4, design `LeadModal` de backoffice-funnel.jsx).
 *
 * Controlado por `lead !== null`. Cada abertura é uma montagem nova do
 * `Conteudo`: o Radix Dialog não renderiza filhos quando `open` é falso, e
 * fechar (mesmo lead ou outro) reseta sozinho todo o estado local — sem isso
 * o modo de perda de um lead vazaria para o próximo que se abrisse.
 *
 * `onMover`/`onConverter`/`onPerder`/`onProximaAcao` devolvem o `Result` da
 * action: é o que permite o diálogo mostrar o erro **aqui dentro** (em vez de
 * só no topo da página) e desabilitar os botões enquanto a chamada está no ar.
 */

function paraLeadFunil(l: LeadRow): LeadFunil {
  return {
    id: l.id,
    estagio: l.estagio,
    estagioDesde: l.estagioDesde,
    situacao: l.situacao,
    acvEstimadoCentavos: l.acvEstimadoCentavos,
    proposta: l.proposta,
    entrada: l.entrada,
    canalSlug: l.canal?.slug ?? null,
    perdidoNoEstagio: l.perdidoNoEstagio,
  };
}

type Props = {
  lead: LeadRow | null;
  estagios: ConfigEstagio[];
  hoje: Date;
  podeEscrever: boolean;
  onClose: () => void;
  onMover: (id: string, estagio: Estagio) => Promise<Result<unknown>>;
  onConverter: (id: string) => Promise<Result<unknown>>;
  onPerder: (
    id: string,
    motivo: MotivoPerda,
    nota: string
  ) => Promise<Result<unknown>>;
  onProximaAcao: (
    id: string,
    texto: string,
    data: string
  ) => Promise<Result<unknown>>;
};

export function LeadDialog({
  lead,
  estagios,
  hoje,
  podeEscrever,
  onClose,
  onMover,
  onConverter,
  onPerder,
  onProximaAcao,
}: Props) {
  return (
    <Dialog
      onOpenChange={(aberto) => {
        if (!aberto) {
          onClose();
        }
      }}
      open={lead !== null}
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
        {lead ? (
          <Conteudo
            estagios={estagios}
            hoje={hoje}
            lead={lead}
            onClose={onClose}
            onConverter={onConverter}
            onMover={onMover}
            onPerder={onPerder}
            onProximaAcao={onProximaAcao}
            podeEscrever={podeEscrever}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({
  lead,
  estagios,
  hoje,
  podeEscrever,
  onClose,
  onMover,
  onConverter,
  onPerder,
  onProximaAcao,
}: {
  lead: LeadRow;
  estagios: ConfigEstagio[];
  hoje: Date;
  podeEscrever: boolean;
  onClose: () => void;
  onMover: Props["onMover"];
  onConverter: Props["onConverter"];
  onPerder: Props["onPerder"];
  onProximaAcao: Props["onProximaAcao"];
}) {
  const [modoPerda, setModoPerda] = useState(false);
  const [motivo, setMotivo] = useState<MotivoPerda | null>(null);
  const [nota, setNota] = useState("");
  const [editandoPasso, setEditandoPasso] = useState(false);
  const [texto, setTexto] = useState(lead.proximaAcao ?? "");
  const [data, setData] = useState(lead.proximaAcaoEm?.slice(0, 10) ?? "");
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const leadFunil = paraLeadFunil(lead);
  const dias = diasNoEstagio(lead.estagioDesde, hoje);
  const cfg = estagios.find((e) => e.codigo === lead.estagio);
  const vencido = estagnado(leadFunil, estagios, hoje);
  const proximo = proximoEstagio(lead.estagio as Estagio);
  const contato =
    [lead.contatoNome, lead.contatoEmail].filter(Boolean).join(" · ") ||
    "sem contato registrado";

  async function executar(
    acao: () => Promise<Result<unknown>>,
    aoSucesso?: () => void
  ) {
    setErro(null);
    setPendente(true);
    const res = await acao();
    setPendente(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    aoSucesso?.();
  }

  function iniciarEdicaoDoPasso() {
    setTexto(lead.proximaAcao ?? "");
    setData(lead.proximaAcaoEm?.slice(0, 10) ?? "");
    setEditandoPasso(true);
  }

  const mostrarProximoPasso =
    lead.situacao === "ATIVO" && lead.estagio !== "PROPOSAL" && !modoPerda;
  const mostrarProposta =
    lead.situacao === "ATIVO" && lead.estagio === "PROPOSAL" && !modoPerda;
  const mostrarModoPerda = lead.situacao === "ATIVO" && modoPerda;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{lead.nome}</DialogTitle>
        <span
          className="mono"
          style={{ fontSize: 11.5, color: "var(--ink-faint)" }}
        >
          {lead.id.slice(0, 8)} · {contato}
        </span>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <Stepper
        estagio={lead.estagio as Estagio}
        estagios={estagios}
        perdidoNoEstagio={lead.perdidoNoEstagio}
      />

      <CartoesResumo estagios={estagios} lead={lead} leadFunil={leadFunil} />

      {lead.situacao !== "ATIVO" ? <BlocoFechado lead={lead} /> : null}
      {mostrarProposta ? <BlocoProposta lead={lead} /> : null}
      {mostrarProximoPasso ? (
        <BlocoProximoPasso
          data={data}
          dias={dias}
          editando={editandoPasso}
          lead={lead}
          onCancelar={() => setEditandoPasso(false)}
          onData={setData}
          onIniciar={iniciarEdicaoDoPasso}
          onSalvar={() =>
            executar(
              () => onProximaAcao(lead.id, texto.trim(), data),
              () => setEditandoPasso(false)
            )
          }
          onTexto={setTexto}
          pendente={pendente}
          podeEscrever={podeEscrever}
          teto={cfg?.tetoDias ?? 0}
          texto={texto}
          vencido={vencido}
        />
      ) : null}
      {mostrarModoPerda ? (
        <ModoPerda
          motivo={motivo}
          nota={nota}
          onMotivo={setMotivo}
          onNota={setNota}
        />
      ) : null}

      <RodapeLeadDialog
        lead={lead}
        leadFunil={leadFunil}
        modoPerda={modoPerda}
        motivo={motivo}
        nota={nota}
        onAvancar={() => {
          if (proximo) {
            executar(() => onMover(lead.id, proximo));
          }
        }}
        onConverter={() => executar(() => onConverter(lead.id))}
        onEntrarModoPerda={() => setModoPerda(true)}
        onFechar={onClose}
        onRegistrarPerda={() => {
          if (motivo) {
            executar(
              () => onPerder(lead.id, motivo, nota.trim()),
              () => setModoPerda(false)
            );
          }
        }}
        onSairModoPerda={() => setModoPerda(false)}
        pendente={pendente}
        podeEscrever={podeEscrever}
        proximo={proximo}
      />
    </>
  );
}
