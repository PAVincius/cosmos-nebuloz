// BPMN→XState v5 compiler — story-028 AC-005
// Pure function, no DOM. Parses BPMN 2.0 XML (lowercase element names per spec).

export type StateConfig = {
  on?: Record<string, { target: string; guard?: string }>;
  type?: "final";
  meta?: Record<string, unknown>;
};

export type MachineConfig = {
  id: string;
  initial: string;
  states: Record<string, StateConfig>;
};

export type CompileError = {
  code: string;
  element?: string;
  message: string;
};

export type CompileResult =
  | { ok: true; machine: MachineConfig }
  | { ok: false; errors: CompileError[] };

// ─── XML helpers ─────────────────────────────────────────────────────────────

function parseAttrs(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /(\w[\w:.-]*)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    result[m[1]] = m[2];
  }
  return result;
}

type BpmnElement = {
  $type: string;
  id: string;
  name?: string;
  sourceRef?: string;
  targetRef?: string;
  conditionExpression?: string;
  waitEvent?: string;
  slaHours?: number;
};

// Matches each opening tag (self-closing or open). Does NOT nest.
// Group 1: namespace prefix ("bpmn:" or "cosmos:")
// Group 2: local name
// Group 3: attribute string
const TAG_RE = /<(bpmn:|cosmos:)([\w]+)\b([^>]*?)(?:\/>|>)/g;

// Extracts conditionExpression text from a sequenceFlow block.
// Used as a second pass to associate conditions with flows.
// Only match non-self-closing sequenceFlows (negative lookbehind for /)
const FLOW_COND_RE =
  /<bpmn:sequenceFlow\b([^>]*)(?<!\/)>[\s\S]*?<bpmn:conditionExpression[^>]*>([^<]+)<\/bpmn:conditionExpression>/g;

function parseElements(xml: string): BpmnElement[] {
  // First pass: build condition map keyed by sequenceFlow id
  const conditionByFlowId = new Map<string, string>();
  const fcRe = new RegExp(FLOW_COND_RE.source, "g");
  let fc: RegExpExecArray | null;
  while ((fc = fcRe.exec(xml)) !== null) {
    const attrs = parseAttrs(fc[1]);
    if (attrs.id) {
      conditionByFlowId.set(attrs.id, fc[2].trim());
    }
  }

  // Second pass: flat tag scan
  const elements: BpmnElement[] = [];
  const re = new RegExp(TAG_RE.source, "g");
  let m: RegExpExecArray | null;

  while ((m = re.exec(xml)) !== null) {
    const ns = m[1];
    const localName = m[2];
    const attrStr = m[3];

    const a = parseAttrs(attrStr);
    const el: BpmnElement = {
      $type: `${ns}${localName}`,
      id: a.id ?? "",
      name: a.name,
      sourceRef: a.sourceRef,
      targetRef: a.targetRef,
    };

    if (a["cosmos:waitEvent"]) {
      el.waitEvent = a["cosmos:waitEvent"];
    }
    if (a["cosmos:slaHours"]) {
      el.slaHours = Number(a["cosmos:slaHours"]);
    }

    if (el.$type === "bpmn:sequenceFlow" && el.id) {
      const cond = conditionByFlowId.get(el.id);
      if (cond) {
        el.conditionExpression = cond;
      }
    }

    elements.push(el);
  }

  return elements;
}

// ─── Allowed element types (BPMN 2.0 lowercase) ──────────────────────────────

const ALLOWED: ReadonlySet<string> = new Set([
  "bpmn:startEvent",
  "bpmn:endEvent",
  "bpmn:task",
  "bpmn:userTask",
  "bpmn:serviceTask",
  "bpmn:exclusiveGateway",
  "bpmn:sequenceFlow",
]);

// Structural/container elements — skip silently
const SKIP: ReadonlySet<string> = new Set([
  "bpmn:definitions",
  "bpmn:process",
  "bpmn:collaboration",
  "bpmn:participant",
  "bpmn:lane",
  "bpmn:laneSet",
  "bpmn:incoming",
  "bpmn:outgoing",
  "bpmn:conditionExpression",
  "bpmn:extensionElements",
  "bpmn:documentation",
]);

function isAllowed(type: string): boolean {
  return ALLOWED.has(type) || type.startsWith("cosmos:");
}

// ─── State name ───────────────────────────────────────────────────────────────

function toStateName(el: BpmnElement): string {
  return el.name ? el.name.trim().replace(/\s+/g, "_") : el.id;
}

// ─── Compiler ─────────────────────────────────────────────────────────────────

export function compileBpmnToXState(xmlString: string): CompileResult {
  const elements = parseElements(xmlString);
  const errors: CompileError[] = [];

  const relevant = elements.filter((e) => !SKIP.has(e.$type));
  const flows = relevant.filter((e) => e.$type === "bpmn:sequenceFlow");
  const nodes = relevant.filter((e) => e.$type !== "bpmn:sequenceFlow");

  for (const el of nodes) {
    if (!isAllowed(el.$type)) {
      errors.push({
        code: "UNSUPPORTED_ELEMENT",
        element: el.id,
        message: `Unsupported element type: ${el.$type}`,
      });
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const startEl = nodes.find((e) => e.$type === "bpmn:startEvent");
  if (!startEl) {
    return {
      ok: false,
      errors: [{ code: "NO_START_EVENT", message: "No bpmn:startEvent found" }],
    };
  }

  const startOutflow = flows.find((f) => f.sourceRef === startEl.id);
  const initialNode = startOutflow
    ? nodes.find((n) => n.id === startOutflow.targetRef)
    : null;

  if (!initialNode) {
    return {
      ok: false,
      errors: [
        {
          code: "NO_INITIAL_STATE",
          message: "StartEvent has no outgoing flow",
        },
      ],
    };
  }

  const initial = toStateName(initialNode);

  const byId = new Map<string, BpmnElement>(nodes.map((e) => [e.id, e]));

  const outgoing = new Map<string, BpmnElement[]>();
  for (const f of flows) {
    if (!f.sourceRef) {
      continue;
    }
    const arr = outgoing.get(f.sourceRef) ?? [];
    arr.push(f);
    outgoing.set(f.sourceRef, arr);
  }

  const states: Record<string, StateConfig> = {};

  for (const node of nodes) {
    if (node.$type === "bpmn:startEvent") {
      continue;
    }

    const stateName = toStateName(node);

    if (node.$type === "bpmn:endEvent") {
      states[stateName] = { type: "final" };
      continue;
    }

    const outs = outgoing.get(node.id) ?? [];
    const on: Record<string, { target: string; guard?: string }> = {};

    if (node.$type === "bpmn:exclusiveGateway") {
      for (const flow of outs) {
        const target = flow.targetRef ? byId.get(flow.targetRef) : undefined;
        if (!target) {
          continue;
        }
        const targetName = toStateName(target);
        const cond = flow.conditionExpression ?? flow.name;
        const eventKey = cond
          ? cond.toUpperCase().replace(/[^A-Z0-9_]/g, "_")
          : `TO_${targetName.toUpperCase()}`;
        on[eventKey] = { target: targetName, ...(cond ? { guard: cond } : {}) };
      }
    } else {
      const flow = outs[0];
      if (flow?.targetRef) {
        const target = byId.get(flow.targetRef);
        if (target) {
          on.NEXT = { target: toStateName(target) };
        }
      }
    }

    const cfg: StateConfig = {};
    if (Object.keys(on).length > 0) {
      cfg.on = on;
    }

    if (node.waitEvent !== undefined || node.slaHours !== undefined) {
      cfg.meta = {};
      if (node.waitEvent !== undefined) {
        cfg.meta.waitEvent = node.waitEvent;
      }
      if (node.slaHours !== undefined) {
        cfg.meta.slaHours = node.slaHours;
      }
    }

    states[stateName] = cfg;
  }

  return { ok: true, machine: { id: "custom-workflow", initial, states } };
}
