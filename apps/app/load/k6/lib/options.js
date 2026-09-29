// Rampa e metas de carga, iguais para todos os produtos.
//
// Padrão do Meridian: 1 a 50 VUs em 3 minutos, p95 < 800 ms, erro < 1 %.
// Alvo remoto tem teto (REMOTE_MAX_VUS, REMOTE_MAX_MINUTES) e um interruptor:
// se o erro passar de 5 % depois dos primeiros 30 s, o k6 aborta sozinho.

export const REMOTE_MAX_VUS = 20;
export const REMOTE_MAX_MINUTES = 5;

/** Tetos do alvo: local sem teto; remoto limitado a REMOTE_MAX_VUS e REMOTE_MAX_MINUTES. */
export function limitsFor(target) {
  return {
    maxVus: target.remote ? REMOTE_MAX_VUS : Number.MAX_SAFE_INTEGER,
    maxSeconds: target.remote
      ? REMOTE_MAX_MINUTES * 60
      : Number.MAX_SAFE_INTEGER,
  };
}

/** Meta de p95 no formato do k6: p95Threshold(800) → "p(95)<800". */
export function p95Threshold(ms) {
  return `p(95)<${ms}`;
}

/** Interruptor de alvo remoto: aborta se o erro passar de 5 % depois de 30 s. */
export function abortOnRemoteErrors() {
  return { threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "30s" };
}

/** Três degraus de mesma duração: sobe a ~40 % do pico, sobe ao pico, segura. */
export function rampStages(peakVus, totalSeconds) {
  const third = Math.max(1, Math.round(totalSeconds / 3));
  return [
    { duration: `${third}s`, target: Math.max(1, Math.round(peakVus * 0.4)) },
    { duration: `${third}s`, target: peakVus },
    { duration: `${third}s`, target: peakVus },
  ];
}

/**
 * @param {object} cfg
 * @param {{remote: boolean}} cfg.target resultado de resolveTarget()
 * @param {string[]} cfg.names nomes das requisições (tag `name`) de cada produto
 * @param {number} [cfg.peakVus=50]
 * @param {number} [cfg.minutes=3]
 * @param {number} [cfg.p95Ms=800]
 * @param {number} [cfg.errorRate=0.01]
 */
export function buildOptions(cfg) {
  const remote = cfg.target.remote;
  const limits = limitsFor(cfg.target);
  const peakVus = Math.min(cfg.peakVus || 50, limits.maxVus);
  const minutes = Math.min((cfg.minutes || 3) * 60, limits.maxSeconds) / 60;
  const p95 = p95Threshold(cfg.p95Ms || 800);
  const errorRate = cfg.errorRate || 0.01;

  const thresholds = {
    http_req_duration: [p95],
    checks: ["rate>0.99"],
    http_req_failed: [`rate<${errorRate}`],
  };
  for (const name of cfg.names) {
    thresholds[`http_req_duration{name:${name}}`] = [p95];
  }
  if (remote) {
    thresholds.http_req_failed.push(abortOnRemoteErrors());
  }

  return {
    scenarios: {
      respondentes: {
        executor: "ramping-vus",
        startVUs: 1,
        stages: rampStages(peakVus, minutes * 60),
        gracefulRampDown: "10s",
      },
    },
    thresholds,
    summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
  };
}
