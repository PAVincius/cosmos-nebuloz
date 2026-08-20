import "server-only";

import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ComplianceMap, MapRow } from "@/app/(charter)/actions/compliance";

// Export do mapa de conformidade em PDF — RFP §6.5 lista PDF entre os formatos
// obrigatórios de export, e é o que um auditor pede na prática.
// @react-pdf/renderer em vez de um browser headless: sem binário extra, sem
// estourar o bundle de uma função serverless, e um relatório de auditoria é
// tabela e texto — exatamente o que a lib faz bem.

/**
 * Título do export e, quando o mapa está incompleto, o aviso que impede
 * alguém de mandar rascunho pensando que é o mapa inteiro. Exportar rascunho
 * é uso legítimo — por isso não é bloqueado — mas só é legítimo se quem
 * recebe sabe que é rascunho.
 */
export function cabecalho(map: ComplianceMap): string {
  const total = map.linhas.length;
  if (map.semVeredito === 0) {
    return `${map.nome} · ${total} exigências`;
  }
  return `${map.nome} · ${total} exigências · ${map.semVeredito} de ${total} sem veredito`;
}

/**
 * Texto da célula de evidência. `evidenciaErro` vira "evidência indisponível"
 * — nunca em branco — porque em branco se leria como prova ausente por a
 * exigência nunca ter sido vinculada a uma capacidade, e não por a consulta
 * ter falhado. Sem capacidade nenhuma vinculada (os dois campos null), o
 * traço aqui é verdadeiro: não há nada para mostrar porque nada foi alegado.
 */
export function formatarEvidencia(row: MapRow): string {
  if (row.evidenciaErro) {
    return "evidência indisponível";
  }
  if (row.evidencia) {
    const { total, de, amostra, lacunas } = row.evidencia;
    const [primeiraAmostra] = amostra;
    // Mesmo sinal que EvidenceBlock (compliance.tsx) usa para "12 de 14" em
    // vez de "12" solto — PDF e CSV são o artefato que sai para o comprador,
    // e as duas leituras do mesmo mapa têm de concordar (ver comentário no
    // topo do arquivo).
    const totalTexto = de === undefined ? String(total) : `${total} de ${de}`;
    const base = primeiraAmostra
      ? `${totalTexto} · ${primeiraAmostra}`
      : totalTexto;
    return lacunas && lacunas.length > 0
      ? `${base} · ${lacunas.length} fora`
      : base;
  }
  return "—";
}

// Excel/Sheets decidem se uma célula é fórmula pelo caractere inicial *depois*
// de fazer o parse do CSV — aspas resolvem injeção de vírgula/quebra de linha
// (RFC4180), não isto. codigo/citacao/resumo/comentario são texto livre sem
// restrição de caractere na importação (RequisitoSchema/SetCoverageSchema em
// compliance.ts) — qualquer um deles abrindo com =, +, -, @, tab ou CR executa
// na máquina de quem abrir o arquivo. Mesmo guard de
// apps/app/components/cosmos/screens/settings-audit-tab.tsx — prefixa com '
// para forçar de volta a texto puro, em vez de inventar uma segunda
// sanitização.
const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

function sanitizeCsvField(value: string): string {
  return FORMULA_INJECTION_RE.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  return `"${sanitizeCsvField(value).replaceAll('"', '""')}"`;
}

/** Exportação em CSV do mapa de conformidade. */
export function toCsv(map: ComplianceMap): string {
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
      csvCell(r.codigo),
      csvCell(r.citacao),
      csvCell(r.resumo),
      // peso é numérico (z.number().int() em RequisitoSchema) — nunca texto
      // digitado por usuário nesta fronteira, então não passa pelo guard.
      // CSV é o formato pensado para processamento posterior (ao contrário do
      // PDF, só para impressão), e um '-' líder de peso negativo forçaria a
      // coluna a virar texto no Excel/Sheets — soma e ordenação silenciosamente
      // param de funcionar, sem erro nenhum para avisar.
      r.peso === null ? "" : String(r.peso),
      csvCell(r.status),
      csvCell(r.comentario ?? ""),
      csvCell(r.capabilityLabel ?? ""),
      // Mesma função usada na célula do PDF: uma consulta de evidência que
      // falhou não pode virar célula em branco aqui e mensagem clara ali —
      // as duas leituras do mesmo mapa têm de concordar. O guard aqui é
      // defesa contra uma mudança futura no formato desta função — hoje
      // formatarEvidencia() sempre abre a célula com "evidência
      // indisponível", "—" ou `${total} ·` (total é um .count(), inteiro não
      // negativo), então o texto livre de amostra nunca é o primeiro
      // caractere e não há caminho de injeção vivo por esta coluna.
      csvCell(formatarEvidencia(r)),
    ].join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8 },
  titulo: { fontSize: 14, marginBottom: 2 },
  subtitulo: { fontSize: 9, marginBottom: 14, color: "#555555" },
  linha: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#dddddd",
    paddingVertical: 4,
  },
  cabecalhoTabela: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
    paddingBottom: 4,
    fontWeight: "bold",
  },
  colCodigo: { width: "8%" },
  colCitacao: { width: "10%" },
  colResumo: { width: "30%", paddingRight: 4 },
  colStatus: { width: "12%" },
  colCapacidade: { width: "18%", paddingRight: 4 },
  colEvidencia: { width: "22%" },
});

function LinhaTabela({ row }: { row: MapRow }) {
  return (
    <View style={styles.linha} wrap={false}>
      <Text style={styles.colCodigo}>{row.codigo}</Text>
      <Text style={styles.colCitacao}>{row.citacao}</Text>
      <Text style={styles.colResumo}>{row.resumo}</Text>
      <Text style={styles.colStatus}>{row.status}</Text>
      <Text style={styles.colCapacidade}>{row.capabilityLabel ?? "—"}</Text>
      <Text style={styles.colEvidencia}>{formatarEvidencia(row)}</Text>
    </View>
  );
}

function ComplianceMapDocument({ map }: { map: ComplianceMap }) {
  return (
    <Document title={map.nome}>
      <Page orientation="landscape" size="A4" style={styles.page}>
        <Text style={styles.titulo}>{map.nome}</Text>
        <Text style={styles.subtitulo}>{cabecalho(map)}</Text>
        {/* fixed: cabeçalho da tabela repete em toda página quando o mapa
         *  quebra — sem isso a segunda página em diante perde a legenda das
         *  colunas. */}
        <View fixed style={styles.cabecalhoTabela}>
          <Text style={styles.colCodigo}>Código</Text>
          <Text style={styles.colCitacao}>Citação</Text>
          <Text style={styles.colResumo}>Resumo</Text>
          <Text style={styles.colStatus}>Status</Text>
          <Text style={styles.colCapacidade}>Capacidade</Text>
          <Text style={styles.colEvidencia}>Evidência</Text>
        </View>
        {map.linhas.map((row) => (
          <LinhaTabela key={row.requirementId} row={row} />
        ))}
      </Page>
    </Document>
  );
}

/**
 * Renderiza o mapa em PDF e devolve o buffer pronto para base64.
 * `renderToBuffer` é a API server-side da lib (roda no runtime Node da
 * action) — nunca no navegador.
 */
export function renderComplianceMapPdf(map: ComplianceMap): Promise<Buffer> {
  return renderToBuffer(<ComplianceMapDocument map={map} />);
}
