import { requireTenantSession } from "@repo/auth/server";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { z } from "zod";
import { indexDocumentChunk } from "@/app/actions/safe-copilot/indexer";

const SESSION_ID_SCHEMA = z.string().uuid();

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const CHUNK_SIZE = 1500; // ~1500 chars per chunk (~375 tokens)
const CHUNK_OVERLAP = 200;
const ALLOWED_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "text/csv",
];

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start >= text.length - CHUNK_OVERLAP) {
      break;
    }
  }
  return chunks.filter((c) => c.length > 50);
}

async function checkUploadRateLimit(tenantId: string): Promise<boolean> {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return false;
  }
  const { createRateLimiter, slidingWindow } = await import("@repo/rate-limit");
  const limiter = createRateLimiter({
    limiter: slidingWindow(10, "1 h"),
    prefix: "copilot:upload",
  });
  const { success } = await limiter.limit(tenantId);
  return success;
}

export async function POST(req: Request) {
  try {
    const headerStore = await headers();
    const ctx = await requireTenantSession(headerStore);

    if (!(await checkUploadRateLimit(ctx.tenantId))) {
      return Response.json(
        { error: "Upload rate limit exceeded (10/hour per tenant)" },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;

    if (!(file && sessionId)) {
      return Response.json(
        { error: "file and sessionId required" },
        { status: 400 }
      );
    }

    if (!SESSION_ID_SCHEMA.safeParse(sessionId).success) {
      return Response.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "Arquivo muito grande (máx 5 MB)" },
        { status: 413 }
      );
    }

    if (!(ALLOWED_TYPES.includes(file.type) || file.name.endsWith(".md"))) {
      return Response.json(
        { error: "Tipo de arquivo não suportado. Use .txt, .md, .csv ou .pdf" },
        { status: 415 }
      );
    }

    let text: string;
    if (file.type === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(Buffer.from(await file.arrayBuffer()));
      text = data.text;
    } else {
      text = await file.text();
    }

    if (text.length < 50) {
      return Response.json(
        { error: "Arquivo muito pequeno ou sem conteúdo legível" },
        { status: 422 }
      );
    }

    const chunks = chunkText(text);

    // Index chunks sequentially (rate-limit safe)
    for (let i = 0; i < chunks.length; i++) {
      await indexDocumentChunk(sessionId, file.name, i, chunks[i] ?? "");
    }

    return Response.json({
      ok: true,
      fileName: file.name,
      chunks: chunks.length,
    });
  } catch (error: unknown) {
    log.error("[copilot/upload]", { error: String(error) });
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
