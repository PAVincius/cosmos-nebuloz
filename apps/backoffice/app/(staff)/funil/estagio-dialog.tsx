"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Badge } from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import {
  atualizarEstagio,
  lerEstagio,
  type MudancaRow,
} from "@/app/actions/funil-config";
import { BotaoSecundario, Erro } from "@/components/campo";
import {
  diasNoEstagio,
  type Estagio,
  INFO_ESTAGIO,
  metricasDoEstagio,
} from "@/lib/comercial/funil";
import {
  CartoesEstagio,
  CriteriosDeSaida,
  EditorDeEstagio,
  ListaLeadsPorTempo,
  RegistroDeMudancas,
} from "./estagio-dialog-partes";
import type { DadosFunil } from "./funil";

/**
 * Painel do estágio (spec §4, design `StagePanel` de
 * backoffice-funnel-stage.jsx).
 *
 * Controlado por `codigo !== null`, mesma convenção de `LeadDialog`: cada
 * abertura monta um `Conteudo` novo, e fechar reseta o modo de edição sozinho.
 *
 * Os 4 cartões e a lista de leads vêm de `dados` (já carregado pelo pai) —
 * `lerEstagio` só traz o que `dados` não tem: o registro de mudanças. Por
 * isso os cartões aparecem no primeiro render e o registro "chega depois".
 */

type Props = {
  codigo: Estagio | null;
  dados: DadosFunil;
  podeEscrever: boolean;
  onClose: () => void;
  onAbrirLead: (id: string) => void;
  onFiltrar: (codigo: Estagio) => void;
  onRecarregar: () => Promise<void>;
};

export function EstagioDialog({
  codigo,
  dados,
  podeEscrever,
  onClose,
  onAbrirLead,
  onFiltrar,
  onRecarregar,
}: Props) {
  return (
    <Dialog
      onOpenChange={(aberto) => {
        if (!aberto) {
          onClose();
        }
      }}
      open={codigo !== null}
    >
      <DialogContent
        className="sm:max-w-3xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
          color: "var(--ink)",
        }}
      >
        {codigo ? (
          <Conteudo
            codigo={codigo}
            dados={dados}
            key={codigo}
            onAbrirLead={onAbrirLead}
            onClose={onClose}
            onFiltrar={onFiltrar}
            onRecarregar={onRecarregar}
            podeEscrever={podeEscrever}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function criteriosMudaram(texto: string, originais: string[]): boolean {
  const parsed = texto
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  return JSON.stringify(parsed) !== JSON.stringify(originais);
}

function Conteudo({
  codigo,
  dados,
  podeEscrever,
  onClose,
  onAbrirLead,
  onFiltrar,
  onRecarregar,
}: {
  codigo: Estagio;
  dados: DadosFunil;
  podeEscrever: boolean;
  onClose: () => void;
  onAbrirLead: (id: string) => void;
  onFiltrar: (codigo: Estagio) => void;
  onRecarregar: () => Promise<void>;
}) {
  const podeEditar = podeEscrever;
  const hoje = new Date(dados.hoje);
  const info = INFO_ESTAGIO[codigo];
  const cfg = dados.estagios.find((e) => e.codigo === codigo);

  const [mudancas, setMudancas] = useState<MudancaRow[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [peso, setPeso] = useState(cfg?.pesoPercent ?? 0);
  const [teto, setTeto] = useState(cfg?.tetoDias ?? 1);
  const [criteriosTexto, setCriteriosTexto] = useState(
    cfg?.criterios.join("\n") ?? ""
  );
  const [motivo, setMotivo] = useState("");
  const [pendente, setPendente] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await lerEstagio({ codigo });
    setCarregando(false);
    if (!res.ok) {
      setErroCarga(res.error);
      return;
    }
    setErroCarga(null);
    setMudancas(res.data.mudancas);
  }, [codigo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!cfg) {
    return <Erro>Estágio não configurado.</Erro>;
  }

  function iniciarEdicao() {
    setPeso(cfg?.pesoPercent ?? 0);
    setTeto(cfg?.tetoDias ?? 1);
    setCriteriosTexto(cfg?.criterios.join("\n") ?? "");
    setMotivo("");
    setErroSalvar(null);
    setEditando(true);
  }

  const dirty =
    peso !== cfg.pesoPercent ||
    teto !== cfg.tetoDias ||
    criteriosMudaram(criteriosTexto, cfg.criterios);
  const motivoValido = motivo.trim().length >= 20;
  const podeRegistrar = dirty && motivoValido && !pendente;

  async function salvar() {
    setPendente(true);
    setErroSalvar(null);
    const res = await atualizarEstagio({
      codigo,
      criterios: criteriosTexto
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
      motivo: motivo.trim(),
      pesoPercent: peso,
      tetoDias: teto,
    });
    setPendente(false);
    if (!res.ok) {
      setErroSalvar(res.error);
      return;
    }
    await onRecarregar();
    await carregar();
    setEditando(false);
  }

  const leadsDoEstagio = dados.leads
    .filter((l) => l.estagio === codigo && l.situacao === "ATIVO")
    .sort(
      (a, b) =>
        diasNoEstagio(b.estagioDesde, hoje) -
        diasNoEstagio(a.estagioDesde, hoje)
    );
  const metricas = metricasDoEstagio(dados.historico, codigo, hoje);

  return (
    <>
      <DialogHeader>
        <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {info.rotulo}
          <Badge tone={info.tom}>
            {cfg.pesoPercent}% · teto {cfg.tetoDias} d
          </Badge>
        </DialogTitle>
        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          {info.descricao}
        </span>
      </DialogHeader>

      {erroCarga ? <Erro>{erroCarga}</Erro> : null}

      <CartoesEstagio
        cfg={cfg}
        hoje={hoje}
        leads={leadsDoEstagio}
        metricas={metricas}
        tone={info.tom}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          gap: 14,
          alignItems: "start",
        }}
      >
        {editando ? (
          <EditorDeEstagio
            criteriosTexto={criteriosTexto}
            erro={erroSalvar}
            motivo={motivo}
            onCancelar={() => setEditando(false)}
            onCriteriosTexto={setCriteriosTexto}
            onMotivo={setMotivo}
            onPeso={setPeso}
            onSalvar={salvar}
            onTeto={setTeto}
            pendente={pendente}
            peso={peso}
            podeRegistrar={podeRegistrar}
            teto={teto}
          />
        ) : (
          <CriteriosDeSaida criterios={cfg.criterios} tone={info.tom} />
        )}
        <ListaLeadsPorTempo
          cfg={cfg}
          hoje={hoje}
          leads={leadsDoEstagio}
          onAbrirLead={onAbrirLead}
        />
      </div>

      {erroCarga ? null : (
        <RegistroDeMudancas carregando={carregando} mudancas={mudancas} />
      )}

      {editando ? null : (
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          {podeEditar ? (
            <BotaoSecundario onClick={iniciarEdicao}>
              Editar estágio
            </BotaoSecundario>
          ) : (
            <span />
          )}
          <BotaoSecundario
            onClick={() => {
              onFiltrar(codigo);
              onClose();
            }}
          >
            Filtrar tabela
          </BotaoSecundario>
        </div>
      )}
    </>
  );
}
