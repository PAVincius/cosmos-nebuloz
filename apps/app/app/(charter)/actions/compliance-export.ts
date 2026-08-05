"use server";

import { withTenantDb } from "@repo/database";
import { z } from "zod";
import {
  cabecalho,
  formatarEvidencia,
  renderComplianceMapPdf,
} from "@/lib/charter/compliance-pdf";
import { requireCharterPermissionContext } from "@/lib/charter/guards";
import { type Result, safeAction } from "../../actions/_base";
import { GovernanceError, logCharterAudit } from "./_shared";
import { type ComplianceMap, getComplianceMap } from "./compliance";

// Export do mapa de conformidade — FR do RFP pede CSV, JSON e PDF; PDF é o
// formato que um auditor pede na prática (RFP §6.5). Exportar mapa incompleto
// é permitido (rascunho é uso legítimo) — o que não é permitido é escondê-lo:
// por isso a auditoria desta exportação carrega o mesmo cabeçalho que o PDF
// mostra, com a contagem de exigências sem veredito.

const ExportSchema = z.object({
  setId: z.string().min(1),
  format: z.enum(["csv", "json", "pdf"]),
});

export type ComplianceMapExport = {
  filename: string;
  mimeType: string;
  content: string;
  encoding: "utf8" | "base64";
};

// Excel/Sheets decidem se uma célula é fórmula pelo caractere inicial *depois*
// de fazer o parse do CSV — aspas resolvem injeção de vírgula/quebra de linha
// (RFC4180), não isto. codigo/citacao/resumo/comentario são texto livre sem
// restrição de caractere na importação (RequisitoSchema/SetCoverageSchema em
// compliance.ts) e a evidência pode carregar texto livre vindo do catálogo de
// capacidades (ex.: nome de pessoa/fornecedor) — qualquer um deles abrindo com
// =, +, -, @, tab ou CR executa na máquina do auditor que abrir o arquivo.
// Mesmo guard de apps/app/components/cosmos/screens/settings-audit-tab.tsx —
// prefixa com ' para forçar de volta a texto puro, em vez de inventar uma
// segunda sanitização.
const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

function sanitizeCsvField(value: string): string {
  return FORMULA_INJECTION_RE.test(value) ? `'${value}` : value;
}

function esc(value: string): string {
  return `"${sanitizeCsvField(value).replaceAll('"', '""')}"`;
}

function toCsv(map: ComplianceMap): string {
  const header = [
    "codigo",
    "citacao",
    "resumo",
    "peso",
    "status",
    "comentario",
    "capacidade",
    "evidencia",
  ];
  const lines = map.linhas.map((r) =>
    [
      r.codigo,
      r.citacao,
      r.resumo,
      r.peso === null ? "" : String(r.peso),
      r.status,
      r.comentario ?? "",
      r.capabilityLabel ?? "",
      // Mesma função usada na célula do PDF: uma consulta de evidência que
      // falhou não pode virar célula em branco aqui e mensagem clara ali —
      // as duas leituras do mesmo mapa têm de concordar.
      formatarEvidencia(r),
    ]
      .map(esc)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

/**
 * Sinaliza rascunho já no nome do arquivo. `cabecalho()` só chega a quem lê
 * o PDF ou a nota de auditoria — quem recebe o CSV/JSON encaminhado por
 * e-mail e não tem acesso à trilha do tenant só vê o nome do arquivo antes de
 * abrir. Uma linha de comentário dentro do corpo do CSV quebraria parser
 * ingênuo (primeira linha = cabeçalho de coluna); o nome do arquivo não
 * arrisca nada e aparece mesmo sem abrir.
 */
function nomeArquivo(
  map: ComplianceMap,
  format: "csv" | "json" | "pdf"
): string {
  const total = map.linhas.length;
  const rascunho =
    map.semVeredito > 0 ? `-rascunho-${map.semVeredito}-de-${total}` : "";
  return `charter-mapa-${map.setId}${rascunho}.${format}`;
}

export async function exportComplianceMap(
  input: z.input<typeof ExportSchema>
): Promise<Result<ComplianceMapExport>> {
  return await safeAction(async () => {
    const ctx = await requireCharterPermissionContext("audit.export");
    const data = ExportSchema.parse(input);

    const mapResult = await getComplianceMap(data.setId);
    if (!mapResult.ok) {
      throw new Error(mapResult.error);
    }
    const map = mapResult.data;

    let content: string;
    let mimeType: string;
    let encoding: "utf8" | "base64";

    if (data.format === "csv") {
      content = toCsv(map);
      mimeType = "text/csv";
      encoding = "utf8";
    } else if (data.format === "json") {
      content = JSON.stringify(map, null, 2);
      mimeType = "application/json";
      encoding = "utf8";
    } else {
      // PDF que falha ao renderizar acusa erro, nunca cai para CSV — devolver
      // formato diferente do pedido sem avisar é como se manda o artefato
      // errado para um auditor sem ninguém perceber.
      let buffer: Buffer;
      try {
        buffer = await renderComplianceMapPdf(map);
      } catch (e) {
        throw new GovernanceError(
          "export.pdf",
          e instanceof Error
            ? `Falha ao gerar PDF: ${e.message}`
            : "Falha ao gerar PDF."
        );
      }
      content = buffer.toString("base64");
      mimeType = "application/pdf";
      encoding = "base64";
    }

    await withTenantDb(ctx.tenantId, async (db) => {
      await logCharterAudit(db, ctx, {
        action: "Exportou mapa de conformidade",
        entityType: "charter.export",
        entityId: map.setId,
        target: `${map.nome} · ${data.format.toUpperCase()}`,
        note: cabecalho(map),
      });
    });

    return {
      filename: nomeArquivo(map, data.format),
      mimeType,
      content,
      encoding,
    };
  });
}
