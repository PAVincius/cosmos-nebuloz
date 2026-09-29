// Relatório de fim de execução: tabela curta com o que o diário pede
// (requisições, erro, p50, p95 por requisição nomeada e o veredito de cada
// meta), mais o JSON completo quando SUMMARY_FILE aponta um arquivo.

function values(metric) {
  if (!metric) {
    return {};
  }
  return metric.values || metric;
}

function ms(n) {
  if (n === undefined || n === null) {
    return "—";
  }
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`;
}

function row(label, metric) {
  const v = values(metric);
  return `  ${label.padEnd(28)} p50 ${ms(v.med).padStart(9)}   p95 ${ms(v["p(95)"]).padStart(9)}   max ${ms(v.max).padStart(9)}`;
}

function verdictOf(threshold) {
  return threshold.ok !== undefined ? threshold.ok : threshold;
}

function thresholdLines(metrics) {
  const lines = [];
  for (const key of Object.keys(metrics)) {
    const thresholds = metrics[key].thresholds || {};
    for (const expr of Object.keys(thresholds)) {
      const mark = verdictOf(thresholds[expr]) ? "ok    " : "FALHA ";
      lines.push(`    ${mark} ${key}  ${expr}`);
    }
  }
  return lines;
}

function headerLines(name, metrics) {
  const reqs = values(metrics.http_reqs).count;
  const failed = values(metrics.http_req_failed).rate;
  const checks = values(metrics.checks).rate;
  return [
    "",
    `Resultado da carga · ${name}`,
    `  requisições ${reqs}   erro ${(failed * 100).toFixed(2)} %   checks ${(checks * 100).toFixed(2)} %`,
    row("todas", metrics.http_req_duration),
  ];
}

/**
 * @param {string} name nome do script (aparece no título)
 * @param {string[]} names nomes das requisições (tag `name`)
 * @param {Record<string,string>} env normalmente `__ENV`
 * @param {{label: string, trend: string, errors: string}[]} [extras] métricas
 *   próprias do script (uma por cenário): `trend` é a Trend de duração e
 *   `errors` a Rate de erro, reportadas em linhas separadas
 * @returns função para `export const handleSummary = ...`
 */
export function makeSummary(name, names, env, extras) {
  return function handleSummary(data) {
    const metrics = data.metrics;
    const lines = headerLines(name, metrics);
    for (const n of names) {
      lines.push(row(n, metrics[`http_req_duration{name:${n}}`]));
    }
    for (const x of extras || []) {
      const errRate = values(metrics[x.errors]).rate;
      lines.push(row(x.label, metrics[x.trend]));
      lines.push(
        `  ${"".padEnd(28)} erro ${((errRate || 0) * 100).toFixed(2)} %`
      );
    }
    lines.push("  metas:", ...thresholdLines(metrics), "");

    const out = { stdout: lines.join("\n") };
    const file = env?.SUMMARY_FILE;
    if (file) {
      out[file] = JSON.stringify(data, null, 2);
    }
    return out;
  };
}
