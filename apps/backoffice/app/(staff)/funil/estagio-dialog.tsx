"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Confirmacao } from "@/components/confirmacao";
import {
  EXPLICACAO_DO_DIALOGO,
  PerguntaDescartar,
  useFecharComRascunho,
  useRascunhoReportado,
} from "@/components/pergunta-descartar";
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
  /** A frase de sucesso da edição, para o funil dizê-la (ver `Funil`). */
  onSalvo?: (frase: string) => void;
  /** A frase da última escrita do funil, dita também aqui dentro: com o
   *  diálogo aberto a página fica fora do alcance do leitor de tela. */
  confirmacao?: string | null;
};

export function EstagioDialog({
  codigo,
  dados,
  podeEscrever,
  onClose,
  onAbrirLead,
  onFiltrar,
  onRecarregar,
  onSalvo,
  confirmacao = null,
}: Props) {
  // Esc, clique fora e X chegam aqui; com edição pendente, a guarda pergunta
  // antes — o `dirty` de dentro era calculado e ignorado no fechamento.
  const guarda = useFecharComRascunho(onClose);
  return (
    <Dialog
      onOpenChange={(aberto) => {
        if (!aberto) {
          guarda.pedirFechar();
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
        {guarda.perguntando ? (
          <PerguntaDescartar
            explicacao={EXPLICACAO_DO_DIALOGO}
            onDescartar={guarda.descartar}
            onVoltar={guarda.voltar}
          />
        ) : null}
        {codigo ? (
          <Conteudo
            codigo={codigo}
            confirmacao={confirmacao}
            dados={dados}
            key={codigo}
            marcarSujo={guarda.marcarSujo}
            onAbrirLead={onAbrirLead}
            onClose={guarda.pedirFechar}
            onFiltrar={onFiltrar}
            onRecarregar={onRecarregar}
            onSalvo={onSalvo}
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
  confirmacao,
  dados,
  podeEscrever,
  marcarSujo,
  onClose,
  onAbrirLead,
  onFiltrar,
  onRecarregar,
  onSalvo,
}: {
  codigo: Estagio;
  confirmacao: string | null;
  dados: DadosFunil;
  podeEscrever: boolean;
  marcarSujo: (sujo: boolean) => void;
  /** Fechar pedido pela tela ("Filtrar tabela") — passa pela guarda. */
  onClose: () => void;
  onAbrirLead: (id: string) => void;
  onFiltrar: (codigo: Estagio) => void;
  onRecarregar: () => Promise<void>;
  onSalvo?: (frase: string) => void;
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

  // Só em edição há o que perder: fora dela peso/teto são só o valor atual.
  // Antes do `return` de estágio sem config, como todo hook.
  useRascunhoReportado(
    editando &&
      cfg !== undefined &&
      (peso !== cfg.pesoPercent ||
        teto !== cfg.tetoDias ||
        criteriosMudaram(criteriosTexto, cfg.criterios) ||
        motivo !== ""),
    marcarSujo
  );

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
    onSalvo?.(`Estágio ${info.rotulo} atualizado.`);
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
        <DialogTitle
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--fs-forte)",
          }}
        >
          {info.rotulo}
          <Badge tone={info.tom}>
            {cfg.pesoPercent}% · teto {cfg.tetoDias} d
          </Badge>
        </DialogTitle>
        <DialogDescription
          style={{ fontSize: "var(--fs-base)", color: "var(--ink-faint)" }}
        >
          {info.descricao}
        </DialogDescription>
      </DialogHeader>

      {erroCarga ? <Erro>{erroCarga}</Erro> : null}
      {confirmacao ? <Confirmacao>{confirmacao}</Confirmacao> : null}

      <CartoesEstagio
        cfg={cfg}
        hoje={hoje}
        leads={leadsDoEstagio}
        metricas={metricas}
        tone={info.tom}
      />

      <div className="bo-duas-colunas" style={{ gap: 14, alignItems: "start" }}>
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
