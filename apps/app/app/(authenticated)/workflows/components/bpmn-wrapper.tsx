"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Modeler from "bpmn-js/lib/Modeler";
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from "bpmn-js-properties-panel";
import TokenSimulationModule from "bpmn-js-token-simulation";
import BpmnColorPickerModule from "bpmn-js-color-picker";
import minimapModule from "diagram-js-minimap";
import BpmnNativeCopyPasteModule from "bpmn-js-native-copy-paste";
import BpmnEmbeddedCommentsModule from "bpmn-js-embedded-comments";
import BpmnLintModule from "bpmn-js-bpmnlint";
import TransactionBoundariesModule from "bpmn-js-transaction-boundaries";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  ImageIcon,
  MessageSquareIcon,
  PlayIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldCheckIcon,
  SquareIcon,
  XCircleIcon,
} from "lucide-react";
import { LINT_CONFIG, type LintIssue } from "../lib/bpmn-lint";

// ─── PT-BR translations ───────────────────────────────────────────────────────
const PT: Record<string, string> = {
  "Create StartEvent": "Início",
  "Create EndEvent": "Fim",
  "Create IntermediateThrowEvent": "Evento Intermediário",
  "Create Task": "Tarefa",
  "Create UserTask": "Tarefa de Usuário",
  "Create ServiceTask": "Tarefa de Serviço",
  "Create ScriptTask": "Tarefa de Script",
  "Create BusinessRuleTask": "Regra de Negócio",
  "Create SendTask": "Envio",
  "Create ReceiveTask": "Recebimento",
  "Create ManualTask": "Tarefa Manual",
  "Create CallActivity": "Chamada",
  "Create SubProcess": "Subprocesso",
  "Create ExclusiveGateway": "Gateway XOR",
  "Create ParallelGateway": "Gateway AND",
  "Create InclusiveGateway": "Gateway OR",
  "Create EventBasedGateway": "Gateway de Evento",
  "Create ComplexGateway": "Gateway Complexo",
  "Create DataObjectReference": "Objeto de Dados",
  "Create DataStoreReference": "Repositório",
  "Create Participant": "Pool/Raia",
  "Create Group": "Grupo",
  "Create TextAnnotation": "Anotação",
  "Activate the hand tool": "Mão (H)",
  "Activate the lasso tool": "Laço (L)",
  "Activate the create/remove space tool": "Espaço",
  "Activate global connect tool": "Conectar (C)",
  Remove: "Remover",
  Edit: "Editar",
  "Append Task": "Adicionar Tarefa",
  "Append EndEvent": "Adicionar Fim",
  "Change type": "Alterar Tipo",
  "Connect using Sequence Flow": "Fluxo de Sequência",
  "Connect using Message Flow": "Fluxo de Mensagem",
};

function customTranslateModule() {
  return {
    translate: [
      "value",
      function (tmpl: string, rep?: Record<string, string>) {
        const t = PT[tmpl] ?? tmpl;
        if (!rep) return t;
        return Object.entries(rep).reduce(
          (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), v),
          t
        );
      },
    ],
  };
}

// ─── Default diagram ──────────────────────────────────────────────────────────

const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Início"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_1" name="Atividade"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="EndEvent_1" name="Fim"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="152" y="162" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="145" y="205" width="50" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="250" y="140" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="412" y="162" width="36" height="36"/><bpmndi:BPMNLabel><dc:Bounds x="409" y="205" width="42" height="14"/></bpmndi:BPMNLabel></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="188" y="180"/><di:waypoint x="250" y="180"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="350" y="180"/><di:waypoint x="412" y="180"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ─── Component ────────────────────────────────────────────────────────────────

interface BpmnWrapperProps {
  teamId: string;
  initialXml?: string;
  onSave?: (xmlContent: string) => Promise<void>;
}

type IssueMap = Record<string, LintIssue[]>;

export function BpmnWrapper({ teamId, initialXml, onSave }: BpmnWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propertiesPanelRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<Modeler | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [lintActive, setLintActive] = useState(true);
  const [lintPanelOpen, setLintPanelOpen] = useState(true);
  const [lintIssues, setLintIssues] = useState<IssueMap>({});
  const [showTransactionBoundaries, setShowTransactionBoundaries] = useState(false);

  const errorCount = Object.values(lintIssues).flat().filter((i) => i.category === "error").length;
  const warnCount  = Object.values(lintIssues).flat().filter((i) => i.category === "warn").length;
  const totalCount = errorCount + warnCount;

  useEffect(() => {
    if (!containerRef.current || !propertiesPanelRef.current) return;

    const modeler = new Modeler({
      container: containerRef.current,
      propertiesPanel: { parent: propertiesPanelRef.current },
      linting: { active: lintActive, bpmnlint: LINT_CONFIG },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        TokenSimulationModule,
        BpmnColorPickerModule,
        minimapModule,
        BpmnNativeCopyPasteModule,
        BpmnEmbeddedCommentsModule,
        BpmnLintModule,
        TransactionBoundariesModule,
        customTranslateModule(),
      ],
    });

    modelerRef.current = modeler;

    modeler.importXML(initialXml || DEFAULT_BPMN_XML).catch((err: unknown) => {
      console.error("Erro ao importar BPMN XML:", err);
    });

    modeler.on("tokenSimulation.toggleMode", (e: any) => setSimulating(!!e.active));

    // Collect lint results from the bpmnlint module overlay events
    modeler.on("linting.completed", (e: any) => {
      const raw: Record<string, any[]> = e.issues ?? {};
      const mapped: IssueMap = {};
      for (const [elementId, issues] of Object.entries(raw)) {
        mapped[elementId] = issues.map((iss: any) => ({
          id:        `${elementId}:${iss.rule}`,
          message:   iss.message,
          category:  iss.category as "error" | "warn",
          rule:      iss.rule,
          elementId,
        }));
      }
      setLintIssues(mapped);
    });

    return () => { modeler.destroy(); };
  }, []);

  const handleSave = useCallback(async () => {
    if (!modelerRef.current || !onSave) return;
    setSaving(true);
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      await onSave(xml);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Falha ao salvar BPMN:", err);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleExportSvg = useCallback(async () => {
    if (!modelerRef.current) return;
    const { svg } = await modelerRef.current.saveSVG({});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `workflow-${teamId}.svg`;
    a.click();
  }, [teamId]);

  const handleExportPng = useCallback(async () => {
    if (!modelerRef.current) return;
    const { svg } = await modelerRef.current.saveSVG({});
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `workflow-${teamId}.png`;
      a.click();
    };
    img.src = url;
  }, [teamId]);

  const handleToggleSimulation = useCallback(() => {
    try { modelerRef.current?.get("toggleMode").toggleMode(); } catch {}
  }, []);

  const handleToggleLint = useCallback(() => {
    try {
      modelerRef.current?.get("linting").toggle();
      setLintActive((v) => !v);
    } catch {}
  }, []);

  const handleToggleTransactionBoundaries = useCallback(() => {
    try {
      const tb = modelerRef.current?.get("transactionBoundaries");
      showTransactionBoundaries ? tb?.hide() : tb?.show();
      setShowTransactionBoundaries((v) => !v);
    } catch {}
  }, [showTransactionBoundaries]);

  const handleNavigateToElement = useCallback((elementId: string) => {
    try {
      const canvas = modelerRef.current?.get("canvas");
      const el = canvas?.findRoot
        ? null
        : modelerRef.current?.get("elementRegistry")?.get(elementId);
      if (el) {
        modelerRef.current?.get("selection")?.select(el);
        canvas?.scrollToElement(el);
      }
    } catch {}
  }, []);

  const allIssues = Object.values(lintIssues).flat();

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-6 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Modelador BPMN</h2>
          <p className="text-xs text-muted-foreground">Equipe: {teamId}</p>
        </div>

        <div className="flex items-center gap-2">
          {simulating && (
            <Badge className="animate-pulse bg-orange-500 text-white text-xs">
              Simulação ativa
            </Badge>
          )}

          {/* Simulate */}
          <Button
            variant={simulating ? "default" : "outline"} size="sm"
            onClick={handleToggleSimulation}
            className={simulating ? "bg-orange-500 hover:bg-orange-600 border-orange-500" : ""}
          >
            {simulating
              ? <><SquareIcon className="mr-1.5 h-3.5 w-3.5" />Parar</>
              : <><PlayIcon className="mr-1.5 h-3.5 w-3.5" />Simular</>}
          </Button>

          {/* Transaction Boundaries */}
          <Button
            variant={showTransactionBoundaries ? "default" : "outline"} size="sm"
            onClick={handleToggleTransactionBoundaries}
            title="Limites de transação — mostra onde transações do BD começam e terminam"
          >
            <ShieldCheckIcon className="mr-1.5 h-3.5 w-3.5" />
            Transações
          </Button>

          {/* Lint toggle */}
          <Button
            variant={lintActive ? "default" : "outline"} size="sm"
            onClick={handleToggleLint}
            className={
              !lintActive ? "" :
              errorCount > 0 ? "bg-red-600 hover:bg-red-700 border-red-600" :
              warnCount  > 0 ? "bg-yellow-500 hover:bg-yellow-600 border-yellow-500" :
              "bg-green-600 hover:bg-green-700 border-green-600"
            }
          >
            <AlertTriangleIcon className="mr-1.5 h-3.5 w-3.5" />
            Lint
            {lintActive && totalCount > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs font-bold">
                {totalCount}
              </span>
            )}
          </Button>

          {/* Comments */}
          <Button variant="outline" size="sm">
            <MessageSquareIcon className="mr-1.5 h-3.5 w-3.5" />
            Comentários
          </Button>

          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExportSvg}>
            <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />SVG
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPng}>
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />PNG
          </Button>

          {/* Save */}
          <Button size="sm" onClick={handleSave} disabled={saving || !onSave}>
            {saving
              ? <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <SaveIcon className="mr-1.5 h-3.5 w-3.5" />}
            {saved ? "Salvo!" : saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Canvas + Properties Panel */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1 bg-white dark:bg-slate-950">
          <div
            ref={containerRef}
            className="absolute inset-0 h-full w-full
              [&_.djs-palette]:rounded-r-lg [&_.djs-palette]:border [&_.djs-palette]:border-l-0 [&_.djs-palette]:shadow-md [&_.djs-palette]:bg-background/95
              [&_.djs-minimap]:rounded-lg [&_.djs-minimap]:border [&_.djs-minimap]:shadow-md [&_.djs-minimap]:overflow-hidden
            "
          />
        </div>

        {/* Properties Panel */}
        <div
          ref={propertiesPanelRef}
          className="w-72 shrink-0 overflow-y-auto border-l bg-background
            [&_.bio-properties-panel]:h-full
            [&_.bio-properties-panel-header]:border-b [&_.bio-properties-panel-header]:bg-muted/40 [&_.bio-properties-panel-header]:px-4 [&_.bio-properties-panel-header]:py-3
            [&_.bio-properties-panel-group-header]:border-b [&_.bio-properties-panel-group-header]:bg-muted/20 [&_.bio-properties-panel-group-header]:px-4 [&_.bio-properties-panel-group-header]:py-2
            [&_.bio-properties-panel-input]:rounded-md [&_.bio-properties-panel-input]:border [&_.bio-properties-panel-input]:px-2 [&_.bio-properties-panel-input]:py-1
          "
        />
      </div>

      {/* Lint Panel */}
      {lintActive && (
        <div className="shrink-0 border-t bg-background">
          <button
            className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium hover:bg-muted/40 transition-colors"
            onClick={() => setLintPanelOpen((v) => !v)}
          >
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground uppercase tracking-wide">Problemas</span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircleIcon className="h-3.5 w-3.5" />
                  {errorCount} {errorCount === 1 ? "erro" : "erros"}
                </span>
              )}
              {warnCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangleIcon className="h-3.5 w-3.5" />
                  {warnCount} {warnCount === 1 ? "aviso" : "avisos"}
                </span>
              )}
              {totalCount === 0 && (
                <span className="text-green-600">Sem problemas detectados</span>
              )}
            </div>
            {lintPanelOpen
              ? <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronUpIcon   className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>

          {lintPanelOpen && allIssues.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-t divide-y">
              {allIssues.map((issue) => (
                <button
                  key={issue.id}
                  className="flex w-full items-start gap-3 px-4 py-2 text-left text-xs hover:bg-muted/40 transition-colors"
                  onClick={() => handleNavigateToElement(issue.elementId)}
                >
                  {issue.category === "error"
                    ? <XCircleIcon       className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                    : <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{issue.message}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {issue.elementId} · {issue.rule}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
