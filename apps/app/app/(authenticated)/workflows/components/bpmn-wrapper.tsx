"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import Modeler from "bpmn-js/lib/Modeler";
import BpmnLintModule from "bpmn-js-bpmnlint";
import BpmnColorPickerModule from "bpmn-js-color-picker";
import BpmnEmbeddedCommentsModule from "bpmn-js-embedded-comments";
import BpmnNativeCopyPasteModule from "bpmn-js-native-copy-paste";
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from "bpmn-js-properties-panel";
import TokenSimulationModule from "bpmn-js-token-simulation";
import TransactionBoundariesModule from "bpmn-js-transaction-boundaries";
import minimapModule from "diagram-js-minimap";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  FolderOpenIcon,
  ImageIcon,
  MessageSquareIcon,
  PlayIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldCheckIcon,
  SquareIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LINT_CONFIG, type LintIssue } from "../lib/bpmn-lint";
import { BPMN_TEMPLATES, type BpmnTemplate } from "../lib/bpmn-templates";

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
      (tmpl: string, rep?: Record<string, string>) => {
        const t = PT[tmpl] ?? tmpl;
        if (!rep) {
          return t;
        }
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

function templateBadgeClass(category: string): string {
  if (category === "safe") {
    return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300";
  }
  if (category === "scrum") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
  }
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

type BpmnWrapperProps = {
  teamId: string;
  initialXml?: string;
  onSave?: (xmlContent: string) => Promise<void>;
};

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
  const [showTransactionBoundaries, setShowTransactionBoundaries] =
    useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const errorCount = Object.values(lintIssues)
    .flat()
    .filter((i) => i.category === "error").length;
  const warnCount = Object.values(lintIssues)
    .flat()
    .filter((i) => i.category === "warn").length;
  const totalCount = errorCount + warnCount;

  useEffect(() => {
    if (!(containerRef.current && propertiesPanelRef.current)) {
      return;
    }

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

    modeler.on("tokenSimulation.toggleMode", (e: Record<string, unknown>) =>
      setSimulating(!!e.active)
    );

    // Collect lint results from the bpmnlint module overlay events
    modeler.on(
      "linting.completed",
      (e: {
        issues?: Record<
          string,
          { rule: string; message: string; category: string }[]
        >;
      }) => {
        const raw = e.issues ?? {};
        const mapped: IssueMap = {};
        for (const [elementId, issues] of Object.entries(raw)) {
          mapped[elementId] = issues.map((iss) => ({
            id: `${elementId}:${iss.rule}`,
            message: iss.message,
            category: iss.category as "error" | "warn",
            rule: iss.rule,
            elementId,
          }));
        }
        setLintIssues(mapped);
      }
    );

    return () => {
      modeler.destroy();
    };
  }, [initialXml, lintActive]);

  const handleSave = useCallback(async () => {
    if (!(modelerRef.current && onSave)) {
      return;
    }
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
    if (!modelerRef.current) {
      return;
    }
    const { svg } = await modelerRef.current.saveSVG({});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = `workflow-${teamId}.svg`;
    a.click();
  }, [teamId]);

  const handleExportPng = useCallback(async () => {
    if (!modelerRef.current) {
      return;
    }
    const { svg } = await modelerRef.current.saveSVG({});
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    );
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
    try {
      modelerRef.current?.get("toggleMode").toggleMode();
    } catch (_) {
      /* bpmn-js module may not be available */
    }
  }, []);

  const handleToggleLint = useCallback(() => {
    try {
      modelerRef.current?.get("linting").toggle();
      setLintActive((v) => !v);
    } catch (_) {
      /* bpmn-js module may not be available */
    }
  }, []);

  const handleLoadTemplate = useCallback(async (template: BpmnTemplate) => {
    if (!modelerRef.current) {
      return;
    }
    try {
      await modelerRef.current.importXML(template.xml);
      setShowTemplates(false);
    } catch (err) {
      console.error("Erro ao carregar template:", err);
    }
  }, []);

  const handleToggleTransactionBoundaries = useCallback(() => {
    try {
      const tb = modelerRef.current?.get("transactionBoundaries");
      if (showTransactionBoundaries) {
        tb?.hide();
      } else {
        tb?.show();
      }
      setShowTransactionBoundaries((v) => !v);
    } catch (_) {
      /* bpmn-js module may not be available */
    }
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
    } catch (_) {
      /* bpmn-js module may not be available */
    }
  }, []);

  const allIssues = Object.values(lintIssues).flat();

  let lintBtnClass = "";
  if (lintActive) {
    if (errorCount > 0) {
      lintBtnClass = "border-red-600 bg-red-600 hover:bg-red-700";
    } else if (warnCount > 0) {
      lintBtnClass = "border-yellow-500 bg-yellow-500 hover:bg-yellow-600";
    } else {
      lintBtnClass = "border-green-600 bg-green-600 hover:bg-green-700";
    }
  }

  let saveBtnLabel = "Salvar";
  if (saved) {
    saveBtnLabel = "Salvo!";
  } else if (saving) {
    saveBtnLabel = "Salvando...";
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-muted/30 px-6 py-3">
        <div>
          <h2 className="font-semibold text-sm tracking-tight">
            Modelador BPMN
          </h2>
          <p className="text-muted-foreground text-xs">Equipe: {teamId}</p>
        </div>

        <div className="flex items-center gap-2">
          {simulating ? (
            <Badge className="animate-pulse bg-orange-500 text-white text-xs">
              Simulação ativa
            </Badge>
          ) : null}

          {/* Templates */}
          <Button
            onClick={() => setShowTemplates((v) => !v)}
            size="sm"
            variant={showTemplates ? "default" : "outline"}
          >
            <FolderOpenIcon className="mr-1.5 h-3.5 w-3.5" />
            Templates
          </Button>

          {/* Simulate */}
          <Button
            className={
              simulating
                ? "border-orange-500 bg-orange-500 hover:bg-orange-600"
                : ""
            }
            onClick={handleToggleSimulation}
            size="sm"
            variant={simulating ? "default" : "outline"}
          >
            {simulating ? (
              <>
                <SquareIcon className="mr-1.5 h-3.5 w-3.5" />
                Parar
              </>
            ) : (
              <>
                <PlayIcon className="mr-1.5 h-3.5 w-3.5" />
                Simular
              </>
            )}
          </Button>

          {/* Transaction Boundaries */}
          <Button
            onClick={handleToggleTransactionBoundaries}
            size="sm"
            title="Limites de transação — mostra onde transações do BD começam e terminam"
            variant={showTransactionBoundaries ? "default" : "outline"}
          >
            <ShieldCheckIcon className="mr-1.5 h-3.5 w-3.5" />
            Transações
          </Button>

          {/* Lint toggle */}
          <Button
            className={lintBtnClass}
            onClick={handleToggleLint}
            size="sm"
            variant={lintActive ? "default" : "outline"}
          >
            <AlertTriangleIcon className="mr-1.5 h-3.5 w-3.5" />
            Lint
            {lintActive && totalCount > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 font-bold text-xs">
                {totalCount}
              </span>
            )}
          </Button>

          {/* Comments */}
          <Button size="sm" variant="outline">
            <MessageSquareIcon className="mr-1.5 h-3.5 w-3.5" />
            Comentários
          </Button>

          {/* Export */}
          <Button onClick={handleExportSvg} size="sm" variant="outline">
            <DownloadIcon className="mr-1.5 h-3.5 w-3.5" />
            SVG
          </Button>
          <Button onClick={handleExportPng} size="sm" variant="outline">
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
            PNG
          </Button>

          {/* Save */}
          <Button disabled={saving || !onSave} onClick={handleSave} size="sm">
            {saving ? (
              <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
            )}
            {saveBtnLabel}
          </Button>
        </div>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="shrink-0 border-b bg-muted/20 px-6 py-4">
          <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Carregar template
          </p>
          <div className="flex flex-wrap gap-3">
            {BPMN_TEMPLATES.map((tpl) => (
              <button
                className="flex flex-col items-start rounded-lg border bg-background px-4 py-3 text-left shadow-[var(--card-shadow)] transition-colors hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary"
                key={tpl.id}
                onClick={() => handleLoadTemplate(tpl)}
                type="button"
              >
                <span className="font-medium text-sm">{tpl.label}</span>
                <span className="mt-0.5 text-muted-foreground text-xs">
                  {tpl.description}
                </span>
                <span
                  className={`mt-2 rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider ${templateBadgeClass(tpl.category)}`}
                >
                  {tpl.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas + Properties Panel */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1 bg-white dark:bg-slate-950">
          <div
            className="[&_.bjs-powered-by]:!hidden absolute inset-0 h-full w-full [&_.djs-minimap]:overflow-hidden [&_.djs-minimap]:rounded-lg [&_.djs-minimap]:border [&_.djs-minimap]:shadow-md [&_.djs-palette]:rounded-r-lg [&_.djs-palette]:border [&_.djs-palette]:border-l-0 [&_.djs-palette]:bg-background/95 [&_.djs-palette]:shadow-md"
            ref={containerRef}
          />
        </div>

        {/* Properties Panel */}
        <div
          className="w-72 shrink-0 overflow-y-auto border-l bg-background [&_.bio-properties-panel-group-header]:border-b [&_.bio-properties-panel-group-header]:bg-muted/20 [&_.bio-properties-panel-group-header]:px-4 [&_.bio-properties-panel-group-header]:py-2 [&_.bio-properties-panel-header]:border-b [&_.bio-properties-panel-header]:bg-muted/40 [&_.bio-properties-panel-header]:px-4 [&_.bio-properties-panel-header]:py-3 [&_.bio-properties-panel-input]:rounded-md [&_.bio-properties-panel-input]:border [&_.bio-properties-panel-input]:px-2 [&_.bio-properties-panel-input]:py-1 [&_.bio-properties-panel]:h-full"
          ref={propertiesPanelRef}
        />
      </div>

      {/* Lint Panel */}
      {lintActive && (
        <div className="shrink-0 border-t bg-background">
          <button
            className="flex w-full items-center justify-between px-4 py-2 font-medium text-xs transition-colors hover:bg-muted/40"
            onClick={() => setLintPanelOpen((v) => !v)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground uppercase tracking-wide">
                Problemas
              </span>
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
            {lintPanelOpen ? (
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronUpIcon className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {lintPanelOpen && allIssues.length > 0 && (
            <div className="max-h-40 divide-y overflow-y-auto border-t">
              {allIssues.map((issue) => (
                <button
                  className="flex w-full items-start gap-3 px-4 py-2 text-left text-xs transition-colors hover:bg-muted/40"
                  key={issue.id}
                  onClick={() => handleNavigateToElement(issue.elementId)}
                  type="button"
                >
                  {issue.category === "error" ? (
                    <XCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{issue.message}</p>
                    <p className="text-[10px] text-muted-foreground">
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
