"use client";

/**
 * Diálogo de criar/editar processo (Task 6, spec §4, design `ProcessDialog`
 * de backoffice-process-map-screen.jsx). Mesmo padrão do `LeadDialog` do
 * funil v2 (`app/(staff)/funil/lead-dialog.tsx`): o Radix Dialog só monta o
 * formulário quando `aberto` é true, e cada abertura é uma montagem nova —
 * fechar e abrir de novo (outro processo, ou "Novo processo" logo depois de
 * editar um) não deixa rascunho vazar de um processo para o próximo.
 *
 * Quem decide `criarProcesso` vs `atualizarProcesso` é o chamador (`mapa.tsx`,
 * via `onSalvar`): este diálogo só monta o input e mostra o `Result` que volta.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useState } from "react";
import type { DiagramaRow, ProcessoRow } from "@/app/actions/processos";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import {
  EXPLICACAO_DO_DIALOGO,
  PerguntaDescartar,
  rascunhoMudou,
  useFecharComRascunho,
  useRascunhoReportado,
} from "@/components/pergunta-descartar";
import {
  CODIGO,
  DOMINIOS,
  type Dominio,
  type Nivel,
} from "@/lib/ferramentas/processos";
import type { Result } from "@/lib/safe-action";
import {
  CampoDiagrama,
  ChipsDominio,
  ChipsNivel,
  ChipsTipo,
} from "./processo-dialog-partes";

export type ProcessoFormInput = {
  codigo: string;
  nome: string;
  descricao: string;
  dominio: Dominio;
  nivel: Nivel;
  tipo: "CORE" | "APOIO";
  donoNome: string | null;
  revisadoEm: string | null;
  tags: string[];
  diagramId: string | null;
  docUrl: string | null;
};

type Props = {
  aberto: boolean;
  processo: ProcessoRow | null;
  diagramas: DiagramaRow[];
  onFechar: () => void;
  onSalvar: (input: ProcessoFormInput) => Promise<Result<unknown>>;
};

export function ProcessoDialog({
  aberto,
  processo,
  diagramas,
  onFechar,
  onSalvar,
}: Props) {
  // Esc, clique fora e X chegam aqui; com rascunho, a guarda pergunta antes.
  const guarda = useFecharComRascunho(onFechar);
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
        className="sm:max-w-2xl"
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
            diagramas={diagramas}
            marcarSujo={guarda.marcarSujo}
            onFechar={onFechar}
            onSalvar={onSalvar}
            processo={processo}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type FormState = {
  codigo: string;
  nome: string;
  descricao: string;
  dominio: Dominio;
  nivel: Nivel;
  tipo: "CORE" | "APOIO";
  donoNome: string;
  revisadoEm: string;
  tagsTexto: string;
  diagramId: string;
  docUrl: string;
};

const DOMINIO_INICIAL = (Object.keys(DOMINIOS) as Dominio[])[0];

function formInicial(processo: ProcessoRow | null): FormState {
  if (!processo) {
    return {
      codigo: "",
      descricao: "",
      diagramId: "",
      docUrl: "",
      dominio: DOMINIO_INICIAL,
      donoNome: "",
      nivel: 1,
      nome: "",
      revisadoEm: "",
      tagsTexto: "",
      tipo: "CORE",
    };
  }
  return {
    codigo: processo.codigo,
    descricao: processo.descricao,
    diagramId: processo.diagramId ?? "",
    docUrl: processo.docUrl ?? "",
    dominio: processo.dominio,
    donoNome: processo.donoNome ?? "",
    nivel: processo.nivel,
    nome: processo.nome,
    // `revisadoEm` chega como ISO datetime (`listarProcessos` serializa com
    // `toISOString()`); o `<input type="date">` só entende os 10 primeiros
    // caracteres.
    revisadoEm: processo.revisadoEm ? processo.revisadoEm.slice(0, 10) : "",
    tagsTexto: processo.tags.join(", "),
    tipo: processo.tipo,
  };
}

function rotuloDoBotao(pendente: boolean): string {
  return pendente ? "Salvando…" : "Salvar";
}

function podeSalvar(f: FormState): boolean {
  return (
    CODIGO.test(f.codigo.trim()) &&
    f.nome.trim().length >= 2 &&
    f.descricao.trim().length > 0
  );
}

const VIRGULA = /,/;

/** `"cac, estágio"` → `["cac", "estágio"]` — separa por vírgula, apara cada
 *  pedaço e descarta os vazios (vírgula solta ou dupla não vira tag ""). */
function paraTags(texto: string): string[] {
  return texto
    .split(VIRGULA)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function paraInput(f: FormState): ProcessoFormInput {
  return {
    codigo: f.codigo.trim(),
    descricao: f.descricao.trim(),
    diagramId: f.diagramId || null,
    docUrl: f.docUrl.trim() || null,
    dominio: f.dominio,
    donoNome: f.donoNome.trim() || null,
    nivel: f.nivel,
    nome: f.nome.trim(),
    revisadoEm: f.revisadoEm || null,
    tags: paraTags(f.tagsTexto),
    tipo: f.tipo,
  };
}

function Formulario({
  processo,
  diagramas,
  marcarSujo,
  onFechar,
  onSalvar,
}: {
  processo: ProcessoRow | null;
  diagramas: DiagramaRow[];
  marcarSujo: (sujo: boolean) => void;
  onFechar: () => void;
  onSalvar: (input: ProcessoFormInput) => Promise<Result<unknown>>;
}) {
  const [form, setForm] = useState<FormState>(() => formInicial(processo));
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useRascunhoReportado(rascunhoMudou(form, formInicial(processo)), marcarSujo);

  function mudar<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function salvar() {
    setErro(null);
    setPendente(true);
    const res = await onSalvar(paraInput(form));
    setPendente(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    onFechar();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle style={{ fontSize: "var(--fs-forte)" }}>
          {processo ? "Editar processo" : "Novo processo"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {processo
            ? "Altera código, nome, domínio, nível, dono, tags e diagrama deste processo do mapa."
            : "Cadastra um processo no mapa: código, nome, domínio, nível, dono, tags e diagrama."}
        </DialogDescription>
      </DialogHeader>

      {erro ? <Erro>{erro}</Erro> : null}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Campo hint="PZ-01" htmlFor="pd-codigo" label="Código">
          <input
            id="pd-codigo"
            onChange={(e) => mudar("codigo", e.target.value)}
            style={INPUT}
            value={form.codigo}
          />
        </Campo>
        <Campo htmlFor="pd-nome" label="Nome">
          <input
            id="pd-nome"
            onChange={(e) => mudar("nome", e.target.value)}
            style={INPUT}
            value={form.nome}
          />
        </Campo>
      </div>

      <Campo htmlFor="pd-descricao" label="Descrição">
        <textarea
          id="pd-descricao"
          onChange={(e) => mudar("descricao", e.target.value)}
          rows={3}
          style={{ ...INPUT, resize: "vertical" }}
          value={form.descricao}
        />
      </Campo>

      <ChipsDominio
        onEscolher={(v) => mudar("dominio", v)}
        valor={form.dominio}
      />
      <ChipsNivel onEscolher={(v) => mudar("nivel", v)} valor={form.nivel} />
      <ChipsTipo onEscolher={(v) => mudar("tipo", v)} valor={form.tipo} />

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Campo hint="opcional" htmlFor="pd-dono" label="Dono">
          <input
            id="pd-dono"
            onChange={(e) => mudar("donoNome", e.target.value)}
            style={INPUT}
            value={form.donoNome}
          />
        </Campo>
        <Campo hint="opcional" htmlFor="pd-revisado" label="Revisado em">
          <input
            id="pd-revisado"
            onChange={(e) => mudar("revisadoEm", e.target.value)}
            style={INPUT}
            type="date"
            value={form.revisadoEm}
          />
        </Campo>
      </div>

      <Campo hint="separadas por vírgula" htmlFor="pd-tags" label="Tags">
        <input
          id="pd-tags"
          onChange={(e) => mudar("tagsTexto", e.target.value)}
          style={INPUT}
          value={form.tagsTexto}
        />
      </Campo>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Campo htmlFor="pd-diagrama" label="Diagrama BPMN">
          <CampoDiagrama
            diagramas={diagramas}
            id="pd-diagrama"
            onEscolher={(v) => mudar("diagramId", v)}
            valor={form.diagramId}
          />
        </Campo>
        <Campo hint="opcional" htmlFor="pd-doc" label="Documento (URL)">
          <input
            id="pd-doc"
            onChange={(e) => mudar("docUrl", e.target.value)}
            style={INPUT}
            value={form.docUrl}
          />
        </Campo>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <BotaoPrimario
          disabled={pendente || !podeSalvar(form)}
          full={false}
          onClick={salvar}
          type="button"
        >
          {rotuloDoBotao(pendente)}
        </BotaoPrimario>
      </div>
    </>
  );
}
