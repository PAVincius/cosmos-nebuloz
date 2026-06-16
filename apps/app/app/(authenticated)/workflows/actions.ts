"use server";

import { gunzipSync, gzipSync } from "node:zlib";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { compileBpmnToXState } from "@/lib/bpmn/compiler";
import {
  type BpmnFlow,
  type BpmnNode,
  validateBpmnGraph,
} from "@/lib/bpmn/validate";

// ─── XML parser helpers (no DOM) ─────────────────────────────────────────────

function extractBpmnGraph(xml: string): {
  nodes: BpmnNode[];
  flows: BpmnFlow[];
  startId: string | null;
} {
  const nodeRe =
    /<bpmn:(startEvent|endEvent|task|userTask|serviceTask|exclusiveGateway|parallelGateway)[^>]*\bid="([^"]+)"/gi;
  const flowRe =
    /<bpmn:sequenceFlow[^>]*\bsourceRef="([^"]+)"[^>]*\btargetRef="([^"]+)"/gi;
  const startRe = /<bpmn:startEvent[^>]*\bid="([^"]+)"/i;

  const nodes: BpmnNode[] = [];
  const flows: BpmnFlow[] = [];

  let m: RegExpExecArray | null = nodeRe.exec(xml);
  while (m !== null) {
    nodes.push({
      id: m[2],
      type: `bpmn:${m[1].charAt(0).toUpperCase()}${m[1].slice(1)}`,
    });
    m = nodeRe.exec(xml);
  }
  m = flowRe.exec(xml);
  while (m !== null) {
    flows.push({ sourceId: m[1], targetId: m[2] });
    m = flowRe.exec(xml);
  }

  const startMatch = startRe.exec(xml);
  return { nodes, flows, startId: startMatch ? startMatch[1] : null };
}

export type BpmnValidationError = {
  code: string;
  elements: { id: string; error: string }[];
};

// ─── Get (decompress) ─────────────────────────────────────────────────────────

export async function getBpmnDefinition(
  definitionId: string
): Promise<string | null> {
  const ctx = await requireTenantSession(await headers());
  const def = await database.bpmnDefinition.findFirst({
    where: { id: definitionId, tenantId: ctx.tenantId },
  });
  if (!def) {
    return null;
  }
  return gunzipSync(def.xmlGzip).toString("utf-8");
}

export async function getActiveBpmnDefinition(
  ownerId: string,
  ownerType: string
): Promise<string | null> {
  const ctx = await requireTenantSession(await headers());
  const def = await database.bpmnDefinition.findFirst({
    where: { tenantId: ctx.tenantId, ownerId, ownerType, active: true },
    orderBy: { version: "desc" },
  });
  if (!def) {
    return null;
  }
  return gunzipSync(def.xmlGzip).toString("utf-8");
}

// Legacy compat: teamId-based lookup used by existing page
export async function getBpmnDefinitionByTeam(
  teamId: string
): Promise<string | null> {
  const ctx = await requireTenantSession(await headers());
  const def = await database.bpmnDefinition.findFirst({
    where: { tenantId: ctx.tenantId, ownerId: teamId, ownerType: "TEAM" },
    orderBy: { version: "desc" },
  });
  if (!def) {
    return null;
  }
  return gunzipSync(def.xmlGzip).toString("utf-8");
}

// ─── Save (validate + gzip + compile) ─────────────────────────────────────────

export type SaveBpmnParams = {
  name: string;
  xml: string;
  entityType: string; // STORY|FEATURE|EPIC|CUSTOM
  ownerType: string; // ORG|TEAM|ART
  ownerId: string;
};

export async function saveBpmnDefinition(
  params: SaveBpmnParams
): Promise<
  { ok: true; id: string } | { ok: false; error: BpmnValidationError }
> {
  const ctx = await requireTenantSession(await headers());
  const { name, xml, entityType, ownerType, ownerId } = params;

  if (!(xml && xml.includes("<bpmn:"))) {
    return {
      ok: false,
      error: {
        code: "BPMN_VALIDATION_ERROR",
        elements: [{ id: "root", error: "Invalid BPMN XML" }],
      },
    };
  }

  if (Buffer.byteLength(xml, "utf-8") > 2 * 1024 * 1024) {
    return {
      ok: false,
      error: {
        code: "BPMN_VALIDATION_ERROR",
        elements: [{ id: "root", error: "XML exceeds 2MB limit" }],
      },
    };
  }

  // Graph validation
  const { nodes, flows, startId } = extractBpmnGraph(xml);
  const graphErrors = validateBpmnGraph(nodes, flows, startId ?? "");
  if (graphErrors.length > 0) {
    return {
      ok: false,
      error: {
        code: "BPMN_VALIDATION_ERROR",
        elements: graphErrors.map((e) => ({
          id: e.nodeId ?? "unknown",
          error: e.message,
        })),
      },
    };
  }

  // Compile to XState
  const compiled = compileBpmnToXState(xml);
  const compiledMachine = compiled.ok ? compiled.machine : null;

  // Gzip
  const xmlGzip = gzipSync(Buffer.from(xml, "utf-8"));

  // Version bump (unique by tenantId+name+ownerType+ownerId)
  const current = await database.bpmnDefinition.findFirst({
    where: { tenantId: ctx.tenantId, name, ownerType, ownerId },
    orderBy: { version: "desc" },
  });
  const nextVersion = current ? current.version + 1 : 1;

  const def = await database.bpmnDefinition.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      entityType,
      ownerType,
      ownerId,
      xmlGzip,
      compiledMachine: compiledMachine
        ? (compiledMachine as import("@repo/database").Prisma.InputJsonValue)
        : undefined,
      version: nextVersion,
      active: false,
    },
  });

  revalidatePath(`/workflows/${ownerId}/bpmn`);
  return { ok: true, id: def.id };
}

// Legacy compat: single-arg save used by existing page/component
export async function saveBpmnDefinitionLegacy(
  teamId: string,
  xmlContent: string
): Promise<void> {
  const result = await saveBpmnDefinition({
    name: `team-${teamId}-workflow`,
    xml: xmlContent,
    entityType: "CUSTOM",
    ownerType: "TEAM",
    ownerId: teamId,
  });
  if (!result.ok) {
    throw new Error(result.error.elements.map((e) => e.error).join("; "));
  }
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export async function activateBpmnDefinition(
  id: string,
  actorId: string
): Promise<void> {
  const ctx = await requireTenantSession(await headers());
  const def = await database.bpmnDefinition.findFirstOrThrow({
    where: { id, tenantId: ctx.tenantId },
  });

  // Deactivate all others for same owner
  await database.bpmnDefinition.updateMany({
    where: {
      tenantId: ctx.tenantId,
      ownerType: def.ownerType,
      ownerId: def.ownerId,
      active: true,
    },
    data: { active: false },
  });

  await database.bpmnDefinition.update({
    where: { id },
    data: { active: true, activatedAt: new Date(), activatedBy: actorId },
  });
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export type DiffChange = {
  type: "added" | "removed";
  kind: "node" | "flow";
  id: string;
  label?: string;
};

export async function diffBpmnDefinitions(
  draftId: string,
  activeId: string
): Promise<DiffChange[]> {
  const ctx = await requireTenantSession(await headers());
  const [draft, active] = await Promise.all([
    database.bpmnDefinition.findFirstOrThrow({
      where: { id: draftId, tenantId: ctx.tenantId },
    }),
    database.bpmnDefinition.findFirstOrThrow({
      where: { id: activeId, tenantId: ctx.tenantId },
    }),
  ]);

  const draftXml = gunzipSync(draft.xmlGzip).toString("utf-8");
  const activeXml = gunzipSync(active.xmlGzip).toString("utf-8");

  const draftGraph = extractBpmnGraph(draftXml);
  const activeGraph = extractBpmnGraph(activeXml);

  const changes: DiffChange[] = [];

  const activeNodeIds = new Set(activeGraph.nodes.map((n) => n.id));
  const draftNodeIds = new Set(draftGraph.nodes.map((n) => n.id));

  for (const n of draftGraph.nodes) {
    if (!activeNodeIds.has(n.id)) {
      changes.push({ type: "added", kind: "node", id: n.id, label: n.type });
    }
  }
  for (const n of activeGraph.nodes) {
    if (!draftNodeIds.has(n.id)) {
      changes.push({ type: "removed", kind: "node", id: n.id, label: n.type });
    }
  }

  const flowKey = (f: BpmnFlow) => `${f.sourceId}→${f.targetId}`;
  const activeFlowKeys = new Set(activeGraph.flows.map(flowKey));
  const draftFlowKeys = new Set(draftGraph.flows.map(flowKey));

  for (const f of draftGraph.flows) {
    if (!activeFlowKeys.has(flowKey(f))) {
      changes.push({ type: "added", kind: "flow", id: flowKey(f) });
    }
  }
  for (const f of activeGraph.flows) {
    if (!draftFlowKeys.has(flowKey(f))) {
      changes.push({ type: "removed", kind: "flow", id: flowKey(f) });
    }
  }

  return changes;
}
