#!/usr/bin/env node
// Modelo local da Nebuloz: llama-server no desktop (RX 580), alcançado pela rede privada (Tailscale).
// Para volume e para dado pessoal de lead: o texto não sai da empresa. Ver docs/runbooks/llm-desktop-windows.md.
//   node .maestri/local/llm.mjs "<instrução>" < arquivo      (o arquivo é opcional)
// Sai 0 com o texto; sai 3 se o desktop estiver fora (quem chama decide o que fazer, sem mandar dado para fora).
// Ambiente: LLM_LOCAL_BASE (ex.: http://nebuloz-gpu:8080/v1) e LLM_LOCAL_KEY (a --api-key do llama-server).
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FORA = 3;
const TIMEOUT_MS = 10 * 60 * 1000; // a RX 580 lê prompt devagar; lote longo leva minutos

export async function perguntar(
  instrucao,
  entrada = "",
  {
    base = process.env.LLM_LOCAL_BASE,
    chave = process.env.LLM_LOCAL_KEY,
    fetchImpl = fetch,
  } = {}
) {
  if (!base) {
    throw Object.assign(new Error("LLM_LOCAL_BASE não definido"), {
      fora: true,
    });
  }
  let res;
  try {
    res = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(chave && { authorization: `Bearer ${chave}` }),
      },
      body: JSON.stringify({
        model: "local",
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: entrada ? `${instrucao}\n\n${entrada}` : instrucao,
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw Object.assign(new Error(`desktop fora do ar: ${e.message}`), {
      fora: true,
    });
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()).choices[0].message.content.trim();
}

async function principal() {
  const instrucao = process.argv[2];
  if (!instrucao) {
    console.error('uso: node .maestri/local/llm.mjs "<instrução>" < arquivo');
    return 2;
  }
  const entrada = process.stdin.isTTY ? "" : readFileSync(0, "utf8");
  try {
    console.log(await perguntar(instrucao, entrada));
    return 0;
  } catch (e) {
    console.error(e.message);
    return e.fora ? FORA : 1;
  }
}

// Caminho real: link simbólico ou /var → /private/var fariam o script não rodar, calado.
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
) {
  process.exitCode = await principal();
}
