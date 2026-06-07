import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { indexDocumentChunk } from "@/app/actions/safe-copilot/indexer";

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

export async function POST(req: Request) {
  try {
    await requireTenantSession(await headers());

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;

    if (!(file && sessionId)) {
      return Response.json(
        { error: "file and sessionId required" },
        { status: 400 }
      );
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

    // Read text content — for PDF we extract text via toString (binary PDFs not parsed here;
    // real PDF text extraction would need a library like pdf-parse or pdfjs-dist)
    const text = await file.text();

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
    console.error("[copilot/upload]", error);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }
}
