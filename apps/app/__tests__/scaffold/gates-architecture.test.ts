import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// O teste que impede a invariante de ser contornada daqui a seis meses.
//
// `gates-negative.test.ts` prova que `closePhase` bloqueia. Este prova que não
// existe OUTRO caminho.
//
// O alvo é preciso, e chegar nele levou duas versões erradas:
//
//   1ª — procurar o literal `state: "CLOSED"`. Não achava nada no próprio
//        arquivo dono, porque `gates.ts` escreve `state: to`, com `to` vindo de
//        `nextState()`. Procurava o sintoma; quem quisesse contornar escreveria
//        `state: algumaVariavel` e passaria.
//   2ª — proibir `scaffoldPhaseInstance.update` fora de `gates.ts`. Larga
//        demais: acusou `steps.ts`, que move a fase entre OPEN e GATE_READY
//        quando um passo é concluído. Isso é bookkeeping de SG-01, não decisão
//        de gate — não grava resultado, não fecha nada, e é reversível.
//
// O perigo real é ESTREITO: uma fase chegar a CLOSED ou OBSERVING sem um
// `ScaffoldGateResult` registrado. Esses dois estados só podem ser escritos por
// `gates.ts`, e como só `gates.ts` os deriva de `nextState()`, qualquer outro
// arquivo teria de escrevê-los como literal — que é o que se procura aqui.
//
// Sem isto, a defesa é convenção. Convenção sobrevive até a primeira
// sexta-feira em que alguém precisa destravar um cliente.

const APP_ROOT = join(import.meta.dirname, "..", "..");
const SKIP = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "generated",
  "dist",
  // Testes fazem mock, não escrevem: uma fixture com `state: "CLOSED"` não é
  // um caminho de produção.
  "__tests__",
  "e2e",
]);
const EXT = /\.(ts|tsx|mts|cts)$/;

const GATES_ACTION = join("app", "(scaffold)", "actions", "gates.ts");

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* sourceFiles(full);
    } else if (EXT.test(entry)) {
      yield full;
    }
  }
}

/** Comentários fora: a linha que EXPLICA a regra não pode acusar violação. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const WRITES_PHASE_STATE =
  /\bscaffoldPhaseInstance\s*\.\s*(?:update|updateMany|upsert)\b/;

/** Estados que só nascem de uma decisão de gate.
 *
 *  O literal sozinho NÃO é violação: `where: { state: "OBSERVING" }` é filtro de
 *  leitura, e a varredura da janela de observação precisa dele. O que caracteriza
 *  a violação é o arquivo escrever fase E mencionar um estado de fechamento —
 *  quem não chama `scaffoldPhaseInstance.update` não tem como fechar nada. */
const CLOSING_STATES = /\bstate\s*:\s*["'`](?:CLOSED|OBSERVING)["'`]/;

const MUTATES_GATE_RECORD =
  /\bscaffoldGate(?:Result|Override)\s*\.\s*(?:update|updateMany|delete|deleteMany|upsert)\b/;

function scan(pattern: RegExp, { except }: { except?: string } = {}): string[] {
  const offenders: string[] = [];
  for (const file of sourceFiles(APP_ROOT)) {
    const rel = file.slice(APP_ROOT.length + 1);
    if (rel === except) {
      continue;
    }
    if (pattern.test(stripComments(readFileSync(file, "utf8")))) {
      offenders.push(rel);
    }
  }
  return offenders;
}

describe("a invariante do gate tem um único dono", () => {
  it("só actions/gates.ts leva uma fase a CLOSED ou OBSERVING", () => {
    // Interseção, não união: só é violação quem escreve fase E cita um estado
    // de fechamento. Ler `state: "OBSERVING"` num `where` é legítimo.
    const writers = new Set(scan(WRITES_PHASE_STATE, { except: GATES_ACTION }));
    const offenders = scan(CLOSING_STATES, { except: GATES_ACTION }).filter(
      (f) => writers.has(f)
    );
    expect(
      offenders,
      `Fase fechada fora de ${GATES_ACTION}. O SRD trata fechamento sem critérios atendidos ou override atribuído como defeito de correção de severidade máxima, não atalho de UX — a decisão tem um dono só.\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("quem mais escreve estado de fase só escreve estados reversíveis", () => {
    // `steps.ts` move a fase entre OPEN e GATE_READY conforme os passos
    // (SG-01). `_phase-reopen.ts` a tira de GATE_READY, BLOCKED, CLOSED ou
    // OBSERVING quando um entregável aprovado é reaberto (SC-PO-03) e só
    // escreve OPEN, como `reopenPhase`. Outro escritor entra nesta lista de
    // propósito — e o teste acima continua garantindo que ele não fecha nada.
    // `lib/inngest/scaffold-charter-control-expired.ts` (CH-PM-03) leva SÓ
    // GATE_READY -> BLOCKED, pela transição CRITERIA_UNMET da máquina, quando um
    // controle do Charter vence; nunca fecha nem reabre fase.
    const writers = scan(WRITES_PHASE_STATE, { except: GATES_ACTION });
    expect([...writers].sort()).toEqual(
      [
        join("app", "(scaffold)", "actions", "_phase-reopen.ts"),
        join("app", "(scaffold)", "actions", "steps.ts"),
        join("lib", "inngest", "scaffold-charter-control-expired.ts"),
      ].sort()
    );
  });

  it("nenhum arquivo atualiza ou apaga resultado de gate ou override (SG-07)", () => {
    const offenders = scan(MUTATES_GATE_RECORD);
    expect(
      offenders,
      `Resultado de gate e override são append-only (SG-07). Reabrir cria registro novo; nada reescreve o anterior.\n${offenders.join("\n")}`
    ).toEqual([]);
  });

  it("o arquivo dono existe, escreve estado de fase e grava o resultado", () => {
    // Guarda contra o teste virar vacuamente verde: se `closePhase` for
    // renomeado ou movido, os testes acima passariam sem nada os sustentar.
    //
    // `scaffoldGateResult.create` é a parte que importa — é o registro sem o
    // qual o fechamento não é auditável.
    const src = stripComments(
      readFileSync(join(APP_ROOT, GATES_ACTION), "utf8")
    );
    expect(WRITES_PHASE_STATE.test(src)).toBe(true);
    expect(src).toContain("export async function closePhase");
    expect(src).toContain("scaffoldGateResult.create");
  });

  it("o estado de destino vem da máquina, não de literal espalhado", () => {
    // `gates.ts` deriva o destino de `nextState()`. Se alguém trocar por um
    // literal, a tabela de transição deixa de ser a autoridade e a máquina
    // vira decoração.
    const src = stripComments(
      readFileSync(join(APP_ROOT, GATES_ACTION), "utf8")
    );
    expect(src).toContain("nextState(");
  });
});
