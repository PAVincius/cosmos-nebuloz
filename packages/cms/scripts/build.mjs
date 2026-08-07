#!/usr/bin/env node
/**
 * Build do CMS, tolerante à ausência do token.
 *
 * `basehub build` gera o client tipado a partir do schema do repositório do
 * BaseHub, e para isso precisa de `BASEHUB_TOKEN`. Sem o token ele sai com
 * erro — e como `@repo/cms` é a primeira tarefa do grafo, o turbo abortava o
 * build inteiro: 0 de 7 pacotes, incluindo os três apps que não têm nada a ver
 * com CMS.
 *
 * Um repositório sem secret configurado não consegue gerar esse client, e não
 * há conserto de código para isso. O que dá para evitar é que a ausência de um
 * token de site de marketing derrube o build do produto.
 *
 * Quando o token existir, nada muda: roda o `basehub build` de sempre.
 */
import { spawnSync } from "node:child_process";

const token = process.env.BASEHUB_TOKEN;

if (!token) {
  // Ruidoso de propósito. Um skip silencioso vira "o CMS buildou" no log de
  // quem lê rápido, e é assim que se descobre em produção que o cliente tipado
  // nunca foi gerado.
  process.stdout.write(
    [
      "",
      "⚠️  BASEHUB_TOKEN ausente — o client tipado do CMS NÃO foi gerado.",
      "",
      "    O que isso significa: apps/web sobe sem os tipos do CMS, e as telas",
      "    que consomem blog e legal não têm garantia de tipo nesta build.",
      "",
      "    Para gerar de verdade, defina BASEHUB_TOKEN (secret do repositório em",
      "    CI, .env.local em desenvolvimento) e rode de novo.",
      "",
    ].join("\n")
  );
  process.exit(0);
}

const r = spawnSync("basehub", ["build"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
