// node --test .maestri/arquivo/arquivar.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { conferido, planejarTranscricoes, redigir } from "./arquivar.mjs";

test("redigir troca o que tem cara de segredo e conta as trocas", () => {
  // Valores falsos montados em tempo de execução: o literal não fica no código (scanner de segredos do PR).
  const falso = (prefixo, n) => prefixo + "Xy7".repeat(n).slice(0, n);
  const chavePrivada = [
    "-----BEGIN OPENSSH",
    "PRIVATE KEY-----\nAAAAfalso\n-----END OPENSSH",
    "PRIVATE KEY-----",
  ].join(" ");
  const texto = [
    `chave ${falso("vck_", 56)} no chat`,
    `OPENAI ${falso("sk-proj-", 40)}`,
    `github ${falso(["gh", "p_"].join(""), 36)}`,
    `aws ${["AK", "IA"].join("")}ABCDEFGHIJKLMNOP`,
    `postgresql://app:${"Senha"}Forte123@db.supabase.co:6543/postgres`,
    chavePrivada,
    "commit abc123 e tenantId comum ficam",
  ].join("\n");
  const r = redigir(texto);
  assert.equal(r.n, 6);
  assert.doesNotMatch(
    r.texto,
    /vck_Xy7|sk-proj-Xy7|p_Xy7|IAABCD|SenhaForte123|AAAAfalso/
  );
  assert.match(r.texto, /postgresql:\/\/app:\[REDIGIDO\]@db\.supabase\.co/);
  assert.match(r.texto, /commit abc123 e tenantId comum ficam/);
});

test("planejarTranscricoes pega só .jsonl com mais de N dias, agrupado por projeto e mês", () => {
  const raiz = mkdtempSync(join(tmpdir(), "arq-"));
  const agora = new Date("2026-09-26T12:00:00Z");
  const arquivo = (proj, nome, iso) => {
    mkdirSync(join(raiz, proj), { recursive: true });
    const f = join(raiz, proj, nome);
    writeFileSync(f, "{}\n");
    const t = new Date(iso);
    utimesSync(f, t, t);
    return f;
  };
  arquivo("-proj-a", "velho1.jsonl", "2026-07-10T10:00:00Z");
  arquivo("-proj-a", "velho2.jsonl", "2026-07-20T10:00:00Z");
  arquivo("-proj-a", "agosto.jsonl", "2026-08-15T10:00:00Z");
  arquivo("-proj-a", "recente.jsonl", "2026-09-20T10:00:00Z");
  arquivo("-proj-b", "nao-jsonl.txt", "2026-06-01T10:00:00Z");
  arquivo("-proj-b", "velho.jsonl", "2026-06-01T10:00:00Z");
  const plano = planejarTranscricoes(raiz, agora, 30);
  assert.deepEqual(
    plano.map((g) => [g.projeto, g.mes, g.arquivos.length]),
    [
      ["-proj-a", "2026-07", 2],
      ["-proj-a", "2026-08", 1],
      ["-proj-b", "2026-06", 1],
    ]
  );
});

test("conferido: só aceita quando o Drive tem o mesmo tamanho do arquivo local", () => {
  assert.equal(conferido(1234, '{"Path":"x.tar.gz","Size":1234}'), true);
  assert.equal(conferido(1234, '{"Path":"x.tar.gz","Size":1200}'), false);
  assert.equal(conferido(1234, "não é json"), false);
});
