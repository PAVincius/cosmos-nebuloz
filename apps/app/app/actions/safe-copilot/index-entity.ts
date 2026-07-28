import { database } from "@repo/database";
import { type Chunk, runInBatches } from "./batch-index";
import { chunkText } from "./chunk-text";

type SourceType =
  | "risk"
  | "pi_objective"
  | "feature"
  | "epic"
  | "okr"
  | "meeting_insight";

type EntityContent = { title: string; body: string };

async function fetchEntityContent(
  sourceType: SourceType,
  sourceId: string,
  tenantId: string
): Promise<EntityContent | null> {
  switch (sourceType) {
    case "epic": {
      const e = await database.epic.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true, descriptionMd: true },
      });
      return e ? { title: e.title, body: e.descriptionMd ?? "" } : null;
    }
    case "feature": {
      const f = await database.feature.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true },
      });
      return f ? { title: f.title, body: "" } : null;
    }
    case "risk": {
      const r = await database.risk.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true, description: true },
      });
      return r
        ? {
            title: r.title,
            body: r.description ?? "",
          }
        : null;
    }
    case "pi_objective": {
      const o = await database.pIObjective.findFirst({
        where: { id: sourceId, tenantId },
        select: { title: true },
      });
      return o ? { title: o.title, body: "" } : null;
    }
    case "meeting_insight": {
      const ins = await database.meetingInsight.findFirst({
        where: { id: sourceId, tenantId },
        select: { type: true, text: true },
      });
      return ins
        ? { title: `Insight de Meeting (${ins.type})`, body: ins.text }
        : null;
    }
    default:
      return null;
  }
}

/**
 * Re-index a single entity after create/update.
 * Takes tenantId directly — safe for fire-and-forget via queueMicrotask.
 *
 * Not a server action — no "use server" directive, so it is not RPC-reachable.
 * Callers must pass a tenantId they already trust, never a caller-supplied
 * value.
 */
export async function indexEntity(
  sourceType: SourceType,
  sourceId: string,
  tenantId: string
): Promise<void> {
  const content = await fetchEntityContent(sourceType, sourceId, tenantId);
  if (!content) {
    return;
  }

  const fullText = [content.title, content.body].filter(Boolean).join("\n\n");
  const chunks = chunkText(fullText);

  const chunkObjs: Chunk[] = chunks.map((text, i) => ({
    tenantId,
    sourceType,
    sourceId,
    chunkIndex: i,
    title: content.title,
    textContent: text,
  }));

  await runInBatches(chunkObjs);
}
