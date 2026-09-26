// node --test .maestri/vigilante/coletar.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  errosDeSessao,
  montarResumo,
  papeis,
  pastaDeSessoes,
} from "./coletar.mjs";

const agora = new Date("2026-09-26T12:00:00Z");
const desde = agora - 24 * 36e5;
const linha = (horasAtras, texto, isError = true) =>
  JSON.stringify({
    type: "user",
    timestamp: new Date(agora - horasAtras * 36e5).toISOString(),
    message: {
      content: [{ type: "tool_result", is_error: isError, content: texto }],
    },
  });

test("pastaDeSessoes segue a regra do Claude Code: / e . viram -", () => {
  assert.equal(
    pastaDeSessoes(
      "/Users/azos/web-office/my/cosmos-nebuloz/.maestri/roles/abc",
      "/h"
    ),
    "/h/.claude/projects/-Users-azos-web-office-my-cosmos-nebuloz--maestri-roles-abc"
  );
});

test("errosDeSessao conta só erro de ferramenta na janela e agrupa pela primeira linha", () => {
  const linhas = [
    linha(1, "Exit code 1\nrtk: rtk find does not support compound predicates"),
    linha(2, "Exit code 1\nrtk: rtk find does not support compound predicates"),
    linha(3, "tudo certo", false),
    linha(30, "fora da janela"),
    "não é json",
    linha(4, [
      { type: "text", text: "Exit code 2\nugrep: schema.prisma: No such file" },
    ]),
  ];
  const r = errosDeSessao(linhas, desde);
  assert.equal(r.total, 3);
  assert.deepEqual(r.top[0], [
    "Exit code 1 · rtk: rtk find does not support compound predicates",
    2,
  ]);
});

test("papeis lê role.json do Ground e dos andares", () => {
  const pai = mkdtempSync(join(tmpdir(), "vig-"));
  const ws = join(pai, "repo");
  const andar = join(pai, ".maestri", "floors", "repo--feat");
  for (const [base, id, nome] of [
    [ws, "a1", "QA"],
    [andar, "b2", "Dev Cosmos"],
  ]) {
    mkdirSync(join(base, ".maestri", "roles", id), { recursive: true });
    writeFileSync(
      join(base, ".maestri", "roles", id, "role.json"),
      JSON.stringify({ id, name: nome })
    );
  }
  assert.deepEqual(
    papeis(ws).map((p) => [p.nome, p.andar]),
    [
      ["QA", undefined],
      ["Dev Cosmos", "repo--feat"],
    ]
  );
});

test("montarResumo junta as seções e o hash não muda se os fatos não mudam", () => {
  const fatos = {
    vereditos: "Aprendizado: 2 eventos em 7 dias",
    concessoes: ["Norte → Regua até 16:00: editar prd"],
    commits: [
      ["Ground", 12],
      ["repo--feat", 3],
    ],
    erros: [{ nome: "QA", total: 2, top: [["Exit code 1 · falhou", 2]] }],
  };
  const a = montarResumo(fatos);
  assert.match(a.texto, /Commits \(24 h\): Ground 12 · repo--feat 3/);
  assert.match(a.texto, /QA: 2 erro\(s\) — 2× Exit code 1 · falhou/);
  assert.equal(a.hash, montarResumo(fatos).hash);
  assert.notEqual(a.hash, montarResumo({ ...fatos, concessoes: [] }).hash);
});
