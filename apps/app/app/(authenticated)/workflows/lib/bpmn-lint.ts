/**
 * bpmnlint config for SAFe enterprise BPMN flows.
 * Imports rule factories directly (no webpack loader needed).
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { is: bpmnIs } = require("bpmnlint-utils");
const NoDisconnected        = require("bpmnlint/rules/no-disconnected");
const LabelRequired         = require("bpmnlint/rules/label-required");
const StartEventRequired    = require("bpmnlint/rules/start-event-required");
const EndEventRequired      = require("bpmnlint/rules/end-event-required");
const NoComplexGateway      = require("bpmnlint/rules/no-complex-gateway");
const NoImplicitSplit       = require("bpmnlint/rules/no-implicit-split");
const NoGatewayJoinFork     = require("bpmnlint/rules/no-gateway-join-fork");
const ConditionalFlows      = require("bpmnlint/rules/conditional-flows");
const FakeJoin              = require("bpmnlint/rules/fake-join");
const SuperfluousGateway    = require("bpmnlint/rules/superfluous-gateway");
const NoDuplicateFlows      = require("bpmnlint/rules/no-duplicate-sequence-flows");

// ─── Built-in rule map ────────────────────────────────────────────────────────

const BPMNLINT_RULES: Record<string, unknown> = {
  "no-disconnected":            NoDisconnected,
  "label-required":             LabelRequired,
  "start-event-required":       StartEventRequired,
  "end-event-required":         EndEventRequired,
  "no-complex-gateway":         NoComplexGateway,
  "no-implicit-split":          NoImplicitSplit,
  "no-gateway-join-fork":       NoGatewayJoinFork,
  "conditional-flows":          ConditionalFlows,
  "fake-join":                  FakeJoin,
  "superfluous-gateway":        SuperfluousGateway,
  "no-duplicate-sequence-flows": NoDuplicateFlows,
};

// ─── Custom SAFe rules ────────────────────────────────────────────────────────

function safeTaskNamed() {
  return {
    check(node: any, reporter: any) {
      const is = bpmnIs;
      if (!is(node, "bpmn:Task")) return;
      if (!node.name?.trim()) {
        reporter.report(node.id, "Tarefas SAFe devem ter nome (representa uma User Story ou atividade de time)");
      }
    },
  };
}

function safeGatewayOutgoingLabels() {
  return {
    check(node: any, reporter: any) {
      const is = bpmnIs;
      if (!is(node, "bpmn:ExclusiveGateway") && !is(node, "bpmn:InclusiveGateway")) return;
      const outgoing = node.outgoing ?? [];
      if (outgoing.length <= 1) return;
      const unlabeled = outgoing.filter((f: any) => !f.name?.trim());
      if (unlabeled.length > 0) {
        reporter.report(node.id, `Gateway com ${unlabeled.length} saída(s) sem rótulo — defina condições para cada caminho`);
      }
    },
  };
}

function safeNoOrphanedLanes() {
  return {
    check(node: any, reporter: any) {
      const is = bpmnIs;
      if (!is(node, "bpmn:Lane")) return;
      const flowElements = node.flowNodeRef ?? [];
      if (flowElements.length === 0) {
        reporter.report(node.id, "Raia (Lane) vazia — adicione atividades ao time/papel");
      }
    },
  };
}

const SAFE_RULES: Record<string, unknown> = {
  "task-named":             safeTaskNamed,
  "gateway-outgoing-label": safeGatewayOutgoingLabels,
  "no-orphaned-lanes":      safeNoOrphanedLanes,
};

// ─── Resolver + Config ────────────────────────────────────────────────────────

export const LINT_CONFIG = {
  config: {
    rules: {
      // Errors — fluxo inválido
      "bpmnlint/no-disconnected":             "error",
      "bpmnlint/start-event-required":        "error",
      "bpmnlint/no-complex-gateway":          "error",
      "bpmnlint/no-duplicate-sequence-flows": "error",
      // Warnings — boas práticas SAFe
      "bpmnlint/label-required":              "warn",
      "bpmnlint/end-event-required":          "warn",
      "bpmnlint/no-implicit-split":           "warn",
      "bpmnlint/no-gateway-join-fork":        "warn",
      "bpmnlint/conditional-flows":           "warn",
      "bpmnlint/fake-join":                   "warn",
      "bpmnlint/superfluous-gateway":         "warn",
      // SAFe custom rules
      "safe/task-named":             "warn",
      "safe/gateway-outgoing-label": "warn",
      "safe/no-orphaned-lanes":      "warn",
    },
  },
  resolver: {
    resolveRule(pkg: string, ruleName: string) {
      if (pkg === "bpmnlint") return BPMNLINT_RULES[ruleName] ?? null;
      if (pkg === "safe")     return SAFE_RULES[ruleName] ?? null;
      return null;
    },
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type LintIssue = {
  id: string;
  message: string;
  category: "error" | "warn";
  rule: string;
  elementId: string;
};
