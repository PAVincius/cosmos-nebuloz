import { safeFileName } from "./file-name";

// S-10 / SN-09 — o handover pack.
//
// "Exporta como arquivo auto-contido, legível sem acesso Nebuloz." É o último
// critério de sucesso do PRD, e o mais fácil de entregar pela metade: um ZIP
// com links para a plataforma passa em qualquer revisão superficial e falha no
// único teste que importa — abrir daqui a um ano, quando o contrato acabou e a
// conta do cliente não existe mais.
//
// Por isso o HTML é literalmente auto-contido: estilo inline, sem script, sem
// CDN, sem fonte remota, sem uma única URL da plataforma. O que o cliente leva
// funciona num navegador offline.
//
// Lógica PURA: monta o HTML e o manifesto. Quem lê o Blob e zipa é a action.

export type HandoverArtefact = { filename: string; sizeBytes: number };

export type HandoverStep = {
  statement: string;
  expectedArtefact: string;
  artefacts: HandoverArtefact[];
};

export type HandoverPhase = {
  phase: string;
  closedAt: Date | null;
  outcome: string | null;
  approverLabel: string | null;
  criteria: { statement: string; met: boolean; note: string | null }[];
  override: {
    actorLabel: string;
    unmetCriteria: string[];
    rationale: string;
    createdAt: Date;
  } | null;
  steps: HandoverStep[];
};

export type HandoverInput = {
  track: {
    code: string;
    processName: string;
    orgName: string;
    archetype: string | null;
    templateLabel: string;
    startedAt: Date;
    embeddedAt: Date | null;
    ownerName: string | null;
    consultantName: string | null;
  };
  phases: HandoverPhase[];
  businessCase: {
    code: string;
    versionLabel: string;
    contentHash: string | null;
    signedByLabel: string | null;
    signedAt: Date | null;
    metrics: {
      label: string;
      unit: string;
      baseValue: string;
      targetValue: string;
      confidence: string;
    }[];
  } | null;
};

export type HandoverPack = {
  archiveName: string;
  indexHtml: string;
  /** Artefatos a copiar do storage para dentro do ZIP. A action resolve o
   *  conteúdo; aqui só o destino. */
  files: { filename: string; path: string }[];
};

/** O nome do processo e a justificativa do override são texto do cliente. Sem
 *  escape, um `<img onerror>` no nome do processo viraria script executando na
 *  máquina de quem abre o pacote — e o pacote é justamente o que sai do nosso
 *  controle. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const date = (d: Date | null): string =>
  d ? d.toLocaleDateString("pt-BR") : "—";

const CONFIDENCE: Record<string, string> = {
  MEASURED: "medido",
  ESTIMATED: "estimado",
  DECLARED: "declarado",
};

function criteriaRows(p: HandoverPhase): string {
  if (p.criteria.length === 0) {
    return "<p class=q>Sem critério registrado.</p>";
  }
  return `<ul class=crit>${p.criteria
    .map(
      (c) =>
        `<li class="${c.met ? "ok" : "no"}">${esc(c.statement)}${
          c.note ? ` <span class=note>${esc(c.note)}</span>` : ""
        }</li>`
    )
    .join("")}</ul>`;
}

function overrideBlock(p: HandoverPhase): string {
  if (!p.override) {
    return "";
  }
  // O override é a decisão mais delicada da trilha. Omiti-lo do pacote que o
  // cliente leva seria entregar uma versão limpa da história — e SG-07 diz
  // que ela é append-only, não editável na saída.
  return `<div class=ovr>
    <div class=ovrh>Gate fechado por override · ${esc(p.override.actorLabel)} · ${date(p.override.createdAt)}</div>
    <div class=ovrc>Critérios dispensados: <b>${esc(p.override.unmetCriteria.join(", "))}</b></div>
    <p>${esc(p.override.rationale)}</p>
  </div>`;
}

function stepsBlock(p: HandoverPhase): string {
  if (p.steps.length === 0) {
    return "";
  }
  return `<ul class=steps>${p.steps
    .map(
      (s) =>
        `<li>${esc(s.statement)}<span class=art>${
          s.artefacts.length > 0
            ? s.artefacts.map((a) => esc(a.filename)).join(", ")
            : esc(s.expectedArtefact)
        }</span></li>`
    )
    .join("")}</ul>`;
}

function businessCaseBlock(bc: HandoverInput["businessCase"]): string {
  if (!bc) {
    return "<p class=q>Esta trilha não emitiu caso de negócio.</p>";
  }
  return `<table>
    <tr><th>Métrica</th><th>Linha de base</th><th>Meta</th><th>Confiança</th></tr>
    ${bc.metrics
      .map(
        (m) =>
          `<tr><td>${esc(m.label)}</td><td class=n>${esc(m.baseValue)} ${esc(m.unit)}</td><td class=n>${esc(m.targetValue)} ${esc(m.unit)}</td><td>${esc(CONFIDENCE[m.confidence] ?? m.confidence)}</td></tr>`
      )
      .join("")}
  </table>
  <p class=sig>Assinado por <b>${esc(bc.signedByLabel ?? "—")}</b> em ${date(bc.signedAt)} · ${esc(bc.code)} ${esc(bc.versionLabel)}${
    bc.contentHash ? ` · ref ${esc(bc.contentHash)}` : ""
  }</p>`;
}

/** Estilo inline e sem fonte remota: daqui a um ano o CDN pode não existir, e o
 *  pacote precisa abrir igual. */
const STYLE = `
:root{color-scheme:light}
body{margin:0;padding:32px;background:#f7f8fa;color:#0d1017;font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:820px;margin:0 auto}
h1{font-size:26px;letter-spacing:-.02em;margin:0 0 4px}
h2{font-size:17px;margin:32px 0 10px;padding-bottom:6px;border-bottom:1px solid #e5e7ec}
.sub{color:#565e6e;margin:0 0 24px}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;padding:16px;background:#fff;border:1px solid #e5e7ec;border-radius:10px}
.meta div span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#636c7b}
.meta div b{font-size:14px}
.ph{padding:16px;background:#fff;border:1px solid #e5e7ec;border-radius:10px;margin-bottom:12px}
.phh{display:flex;justify-content:space-between;gap:12px;font-weight:700;margin-bottom:8px}
.phh em{font-style:normal;font-weight:500;color:#636c7b;font-size:13px}
ul{margin:0;padding-left:20px}
.crit li.ok::marker{content:"✓ "}
.crit li.no::marker{content:"✗ "}
.crit li.no{color:#a7244a}
.note{color:#636c7b;font-size:13px}
.steps li{margin-bottom:4px}
.art{display:block;font-size:12px;color:#276592}
.ovr{margin-top:12px;padding:12px;background:#fdf6e3;border:1px solid #e0cf9a;border-radius:8px;font-size:13px}
.ovrh{font-weight:700;color:#76570e;margin-bottom:4px}
.ovrc{margin-bottom:6px}
.ovr p{margin:0;color:#565e6e}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e5e7ec;border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #eef0f4;font-size:14px}
th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#636c7b;background:#f7f8fa}
td.n{font-variant-numeric:tabular-nums;font-weight:700}
.sig{font-size:13px;color:#565e6e}
.q{color:#636c7b;font-style:italic}
footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7ec;font-size:12.5px;color:#636c7b}
`;

/** Caminho do artefato dentro do ZIP: `artefatos/<fase>/<nome>`. O nome é o último
 *  segmento do que o navegador mandou (`safeFileName`), então "../" e caminho
 *  absoluto não saem da pasta; nome repetido na fase ganha " (n)" antes da
 *  extensão. `taken` guarda os caminhos já usados, sem diferenciar caixa
 *  (extrair no Windows ou no macOS juntaria "A.pdf" e "a.pdf"). */
function zipEntryPath(
  phase: string,
  filename: string,
  taken: Set<string>
): string {
  const name = safeFileName(filename);
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = `artefatos/${phase}/${name}`;
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) {
    candidate = `artefatos/${phase}/${stem} (${n})${ext}`;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

export function buildHandoverPack(input: HandoverInput): HandoverPack {
  const t = input.track;

  // Mesma ordem de fase, passo e artefato com que a action baixa os objetos: o
  // i-ésimo arquivo do storage vai para o i-ésimo caminho.
  const taken = new Set<string>();
  const files = input.phases.flatMap((p) =>
    p.steps.flatMap((s) =>
      s.artefacts.map((a) => ({
        filename: a.filename,
        // Agrupado por fase: quem abre o pacote procura pela fase, não pelo id
        // do passo. O nome vem do navegador de quem anexou: só o último
        // segmento, e sem repetir nome na mesma fase (zip-slip e sobrescrita).
        path: zipEntryPath(p.phase, a.filename, taken),
      }))
    )
  );

  const indexHtml = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Handover · ${esc(t.code)} · ${esc(t.processName)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${esc(t.processName)}</h1>
<p class=sub>${esc(t.orgName)} · trilha ${esc(t.code)}${t.archetype ? ` · ${esc(t.archetype)}` : ""}</p>

<div class=meta>
  <div><span>Dono do processo</span><b>${esc(t.ownerName ?? "—")}</b></div>
  <div><span>Consultor</span><b>${esc(t.consultantName ?? "—")}</b></div>
  <div><span>Início</span><b>${date(t.startedAt)}</b></div>
  <div><span>Entregue em</span><b>${date(t.embeddedAt)}</b></div>
  <div><span>Método</span><b>${esc(t.templateLabel)}</b></div>
</div>

<h2>Promessa medida</h2>
${businessCaseBlock(input.businessCase)}

<h2>Histórico de fases</h2>
${
  input.phases.length === 0
    ? "<p class=q>Sem fase registrada.</p>"
    : input.phases
        .map(
          (p) => `<div class=ph>
  <div class=phh><span>${esc(p.phase)}</span><em>${
    p.closedAt ? `fechada em ${date(p.closedAt)}` : "não fechada"
  }${p.approverLabel ? ` · ${esc(p.approverLabel)}` : ""}</em></div>
  ${criteriaRows(p)}
  ${stepsBlock(p)}
  ${overrideBlock(p)}
</div>`
        )
        .join("\n")
}

<footer>
  Este pacote é auto-contido: abre em qualquer navegador, sem conta e sem
  conexão. Os arquivos entregues em cada fase estão na pasta
  <b>artefatos/</b>, ao lado deste documento.
</footer>
</main>
</body>
</html>`;

  return { archiveName: `handover-${t.code}.zip`, indexHtml, files };
}
