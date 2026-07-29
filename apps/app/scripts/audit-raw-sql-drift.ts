/**
 * audit-raw-sql-drift.ts — audita o que `prisma migrate diff` é cego a ver.
 *
 * Contexto: 73 das 78 linhas de _prisma_migrations têm applied_steps_count = 0 —
 * o SQL bruto dessas migrations nunca executou; o schema existe porque rodaram
 * `db push`, que só materializa schema.prisma (tabelas/colunas/índices/enums).
 * Tudo que vive fora do schema.prisma — funções, triggers, policies, grants,
 * CHECKs, ON DELETE de FK escrito à mão, backfills de dados — pode estar
 * ausente no banco vivo enquanto o disco diz que foi aplicado.
 *
 * Este script lê as migrations do disco, extrai os objetos esperados e confronta
 * com o catálogo vivo (pg_proc, pg_trigger, pg_constraint, pg_extension,
 * information_schema.role_table_grants). Read-only: não altera nada.
 * Sai com código 1 se houver qualquer achado acionável — serve como gate de CI.
 *
 * Uso: cd apps/app && pnpm tsx scripts/audit-raw-sql-drift.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

// apps/app/scripts → raiz do monorepo
const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/database/prisma/migrations"
);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── padrões ──────────────────────────────────────────────────────────────────

const RE_MIGRATION_DIR = /^\d{14}_/;
const RE_DOLLAR_TAG = /^\$[A-Za-z_]*\$/;
const RE_QUOTES = /^"|"$/g;
const RE_WS = /\s+/g;
const RE_STARTS_DO = /^DO\b/i;
const RE_ESCAPED_QUOTE = /\\'/g;
const RE_DOUBLED_QUOTE = /''/g;
const RE_FUNCTION =
  /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+("?[\w"]+"?)\s*\(/gi;
const RE_TRIGGER =
  /CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+("?\w+"?)[\s\S]*?\bON\s+("?\w+"?)/gi;
const RE_FK =
  /ALTER\s+TABLE\s+(?:ONLY\s+)?("?\w+"?)[\s\S]*?ADD\s+CONSTRAINT\s+("?\w+"?)\s+FOREIGN\s+KEY[\s\S]*?REFERENCES[^;]*/gi;
const RE_ON_DELETE =
  /ON\s+DELETE\s+(CASCADE|RESTRICT|SET\s+NULL|SET\s+DEFAULT|NO\s+ACTION)/i;
const RE_ON_UPDATE =
  /ON\s+UPDATE\s+(CASCADE|RESTRICT|SET\s+NULL|SET\s+DEFAULT|NO\s+ACTION)/i;
const RE_CHECK =
  /ALTER\s+TABLE\s+(?:ONLY\s+)?("?\w+"?)[\s\S]*?ADD\s+CONSTRAINT\s+("?\w+"?)\s+CHECK/gi;
const RE_EXTENSION =
  /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi;
const RE_GRANT = /^\s*(GRANT|REVOKE)\b/i;
const RE_DROP_TRIGGER = /DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?("?\w+"?)/i;
const RE_CREATE_TRIGGER = /CREATE\s+TRIGGER/i;
const RE_DROP_CONSTRAINT =
  /ALTER\s+TABLE[\s\S]*?DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?("?\w+"?)/i;
const RE_ADD_CONSTRAINT = /ADD\s+CONSTRAINT/i;

/** Statements que o diff estrutural JÁ enxerga — fora do escopo desta auditoria. */
const VISIBLE_TO_DIFF = [
  /^CREATE\s+(UNIQUE\s+)?INDEX/,
  /^DROP\s+INDEX/,
  /^CREATE\s+TABLE/,
  /^DROP\s+TABLE/,
  /^CREATE\s+TYPE/,
  /^DROP\s+TYPE/,
  /^ALTER\s+TABLE[\s\S]*?\bADD\s+COLUMN\b/,
  /^ALTER\s+TABLE[\s\S]*?\bDROP\s+COLUMN\b/,
  /^ALTER\s+TABLE[\s\S]*?\bALTER\s+COLUMN\b/,
  /^ALTER\s+TABLE[\s\S]*?\bRENAME\b/,
];

// ── parsing das migrations ───────────────────────────────────────────────────

/** Split em statements respeitando dollar-quoting, strings e comentários. */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let dollarTag: string | null = null;
  let inSingle = false;
  let inLineComment = false;

  while (i < sql.length) {
    const ch = sql[i] as string;
    const rest = sql.slice(i);

    if (inLineComment) {
      cur += ch;
      if (ch === "\n") {
        inLineComment = false;
      }
      i++;
      continue;
    }
    if (!(dollarTag || inSingle) && rest.startsWith("--")) {
      inLineComment = true;
      cur += ch;
      i++;
      continue;
    }
    if (dollarTag) {
      if (rest.startsWith(dollarTag)) {
        cur += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (inSingle) {
      cur += ch;
      if (ch === "'") {
        inSingle = false;
      }
      i++;
      continue;
    }
    const dq = rest.match(RE_DOLLAR_TAG);
    if (dq) {
      dollarTag = dq[0];
      cur += dollarTag;
      i += dollarTag.length;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      cur += ch;
      i++;
      continue;
    }
    if (ch === ";") {
      out.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim()) {
    out.push(cur.trim());
  }
  return out.filter(Boolean);
}

const stripComments = (s: string) =>
  s
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .trim();

type Stmt = { dir: string; bare: string };

function loadStatements(): Stmt[] {
  const dirs = readdirSync(MIGRATIONS)
    .filter((d) => RE_MIGRATION_DIR.test(d))
    .sort();
  const stmts: Stmt[] = [];
  for (const dir of dirs) {
    let sql: string;
    try {
      sql = readFileSync(join(MIGRATIONS, dir, "migration.sql"), "utf8");
    } catch {
      continue;
    }
    for (const raw of splitStatements(sql)) {
      const bare = stripComments(raw);
      const isStructural = VISIBLE_TO_DIFF.some((re) =>
        re.test(bare.toUpperCase())
      );
      if (bare && !isStructural) {
        stmts.push({ dir, bare });
      }
    }
  }
  return stmts;
}

const unq = (s: string) => s.replace(RE_QUOTES, "");

// ── objetos esperados, derivados do disco ────────────────────────────────────

type Expected = {
  functions: Map<string, string>;
  triggers: Map<string, { table: string; dir: string }>;
  fks: Map<
    string,
    { table: string; onDelete: string; onUpdate: string; dir: string }
  >;
  checks: Map<string, { table: string; dir: string }>;
  extensions: Map<string, string>;
  grants: { sql: string; dir: string }[];
};

/** Postgres normaliza a ausência de ON DELETE/UPDATE para NO ACTION. */
const normAction = (a: string | undefined) =>
  (a ?? "NO ACTION").toUpperCase().replace(RE_WS, " ").trim();

function collectFromBody(exp: Expected, body: string, dir: string) {
  for (const m of body.matchAll(RE_FUNCTION)) {
    exp.functions.set(unq(m[1] as string), dir);
  }
  for (const m of body.matchAll(RE_TRIGGER)) {
    exp.triggers.set(unq(m[1] as string), { table: unq(m[2] as string), dir });
  }
  for (const m of body.matchAll(RE_FK)) {
    const chunk = m[0];
    exp.fks.set(unq(m[2] as string), {
      table: unq(m[1] as string),
      onDelete: normAction(chunk.match(RE_ON_DELETE)?.[1]),
      onUpdate: normAction(chunk.match(RE_ON_UPDATE)?.[1]),
      dir,
    });
  }
  for (const m of body.matchAll(RE_CHECK)) {
    exp.checks.set(unq(m[2] as string), { table: unq(m[1] as string), dir });
  }
  for (const m of body.matchAll(RE_EXTENSION)) {
    exp.extensions.set(m[1] as string, dir);
  }
  if (RE_GRANT.test(body)) {
    exp.grants.push({ sql: body, dir });
  }
}

function collectExpected(stmts: Stmt[]): Expected {
  const exp: Expected = {
    functions: new Map(),
    triggers: new Map(),
    fks: new Map(),
    checks: new Map(),
    extensions: new Map(),
    grants: [],
  };

  for (const { dir, bare } of stmts) {
    collectFromBody(exp, bare, dir);
    // Blocos DO escondem DDL dentro de EXECUTE '…' — metade das declarações de
    // RLS mora aí. Desescapa as aspas e varre de novo.
    if (RE_STARTS_DO.test(bare)) {
      collectFromBody(
        exp,
        bare.replace(RE_ESCAPED_QUOTE, "'").replace(RE_DOUBLED_QUOTE, "'"),
        dir
      );
    }

    // DROP posteriores invalidam expectativas anteriores (last-write-wins).
    const dropTrg = bare.match(RE_DROP_TRIGGER);
    if (dropTrg && !RE_CREATE_TRIGGER.test(bare)) {
      exp.triggers.delete(unq(dropTrg[1] as string));
    }
    const dropCon = bare.match(RE_DROP_CONSTRAINT);
    if (dropCon && !RE_ADD_CONSTRAINT.test(bare)) {
      exp.fks.delete(unq(dropCon[1] as string));
      exp.checks.delete(unq(dropCon[1] as string));
    }
  }
  return exp;
}

// ── exceções conhecidas ──────────────────────────────────────────────────────
//
// Achados já investigados que NÃO são drift. Ficam aqui (e não filtrados no
// parser) para que a razão seja auditável, e para que o dia em que deixarem de
// valer apareça como um item que ninguém sabe explicar.

/**
 * Funções/triggers que existem no disco mas devem permanecer ausentes do banco.
 * Vazio hoje: 20260728020000 segurou epic_lifecycle_guard e decision_log_immutable,
 * os dois ajustes de código foram feitos (moveEpic → XState; seed desabilita o
 * trigger na limpeza) e 20260728030000 os habilitou. Mantido como ponto de
 * extensão — quem retiver um objeto de novo registra aqui a razão, para a
 * ausência continuar explicada em vez de virar mistério.
 */
const RETIDOS: Record<string, string> = {};

/** FKs cujo objeto no disco morreu num rename/drop posterior. */
const FK_OBSOLETAS: Record<string, string> = {
  // 20260523100000 renomeou as tabelas Copilot* PascalCase → snake_case; as FKs
  // vieram junto com nomes novos. CopilotToolInvocation/CopilotSuggestion nem
  // existem mais no banco vivo.
  CopilotSession_tenantId_fkey: "renomeada → copilot_sessions_tenantId_fkey",
  CopilotMessage_sessionId_fkey: "renomeada → copilot_messages_sessionId_fkey",
  CopilotToolInvocation_sessionId_fkey: "tabela não existe mais",
  CopilotSuggestion_sessionId_fkey: "tabela não existe mais",
  // schema.prisma mapeia o model para "TenantSecurityPolicy", não para o
  // snake_case que a migration 20260609000018 escreveu à mão.
  tenant_security_policies_tenantId_fkey:
    "tabela viva é TenantSecurityPolicy; FK existe como TenantSecurityPolicy_tenantId_fkey",
};

/**
 * ON UPDATE CASCADE vivo contra NO ACTION escrito na migration não é perda: é o
 * default do Prisma (schema.prisma, fonte da verdade) tendo vencido a migration
 * escrita à mão. O db push aplicou o certo. Só reportamos o sentido inverso.
 */
const onUpdateDriftBenigno = (live: string, expected: string) =>
  live === "CASCADE" && expected === "NO ACTION";

// ── catálogo vivo ────────────────────────────────────────────────────────────

const CONFDELTYPE: Record<string, string> = {
  a: "NO ACTION",
  r: "RESTRICT",
  c: "CASCADE",
  n: "SET NULL",
  d: "SET DEFAULT",
};

async function q<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const r = await pool.query(sql);
  return r.rows as T[];
}

// ── relatório ────────────────────────────────────────────────────────────────

type Finding = { severity: "MISSING" | "DRIFT" | "INFO"; detail: string };
const findings: Finding[] = [];
const add = (severity: Finding["severity"], detail: string) => {
  findings.push({ severity, detail });
};

async function auditLedger() {
  const ledger = await q<{ applied_steps_count: number }>(
    "SELECT applied_steps_count FROM _prisma_migrations"
  );
  const baselined = ledger.filter((r) => Number(r.applied_steps_count) === 0);
  add(
    "INFO",
    `_prisma_migrations: ${ledger.length} linhas, ${baselined.length} com applied_steps_count=0 (SQL bruto nunca executou)`
  );
}

async function auditFunctions(exp: Expected) {
  const live = new Set(
    (
      await q<{ proname: string }>(
        `SELECT p.proname FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'`
      )
    ).map((r) => r.proname)
  );
  for (const [fn, dir] of exp.functions) {
    if (live.has(fn)) {
      continue;
    }
    const retido = RETIDOS[fn];
    if (retido) {
      add("INFO", `function ${fn}() retida — ${retido}`);
    } else {
      add("MISSING", `function ${fn}() — de ${dir}`);
    }
  }
}

async function auditTriggers(exp: Expected) {
  const live = new Map(
    (
      await q<{ tgname: string; relname: string }>(
        `SELECT t.tgname, c.relname
           FROM pg_trigger t
           JOIN pg_class c ON c.oid = t.tgrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE NOT t.tgisinternal AND n.nspname = 'public'`
      )
    ).map((r) => [r.tgname, r.relname] as const)
  );
  for (const [trg, { table, dir }] of exp.triggers) {
    const on = live.get(trg);
    if (!on) {
      const retido = RETIDOS[trg];
      if (retido) {
        add("INFO", `trigger ${trg} retido — ${retido}`);
      } else {
        add("MISSING", `trigger ${trg} ON "${table}" — de ${dir}`);
      }
      continue;
    }
    if (on !== table) {
      add("DRIFT", `trigger ${trg} está em "${on}", esperado "${table}"`);
    }
  }
}

type LiveConstraint = {
  conname: string;
  relname: string;
  confdeltype: string;
  confupdtype: string;
};

async function auditConstraints(exp: Expected) {
  const live = new Map(
    (
      await q<LiveConstraint>(
        `SELECT c.conname, r.relname, c.confdeltype, c.confupdtype
           FROM pg_constraint c
           JOIN pg_class r ON r.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = r.relnamespace
          WHERE n.nspname = 'public' AND c.contype IN ('f','c')`
      )
    ).map((r) => [r.conname, r] as const)
  );

  for (const [name, { table, onDelete, onUpdate, dir }] of exp.fks) {
    const row = live.get(name);
    if (!row) {
      const motivo = FK_OBSOLETAS[name];
      if (motivo) {
        add("INFO", `FK ${name} ausente por desenho — ${motivo}`);
      } else {
        add("MISSING", `FK ${name} ON "${table}" — de ${dir}`);
      }
      continue;
    }
    const liveDel = CONFDELTYPE[row.confdeltype] ?? row.confdeltype;
    const liveUpd = CONFDELTYPE[row.confupdtype] ?? row.confupdtype;
    if (liveDel !== onDelete) {
      add(
        "DRIFT",
        `FK ${name} ON "${table}": ON DELETE vivo=${liveDel}, migration(${dir})=${onDelete}`
      );
    }
    if (liveUpd !== onUpdate && !onUpdateDriftBenigno(liveUpd, onUpdate)) {
      add(
        "DRIFT",
        `FK ${name} ON "${table}": ON UPDATE vivo=${liveUpd}, migration(${dir})=${onUpdate}`
      );
    }
  }

  for (const [name, { table, dir }] of exp.checks) {
    if (!live.has(name)) {
      add("MISSING", `CHECK ${name} ON "${table}" — de ${dir}`);
    }
  }
}

async function auditExtensionsAndGrants(exp: Expected) {
  const live = new Set(
    (await q<{ extname: string }>("SELECT extname FROM pg_extension")).map(
      (r) => r.extname
    )
  );
  for (const [ext, dir] of exp.extensions) {
    if (!live.has(ext)) {
      add("MISSING", `extension "${ext}" — de ${dir}`);
    }
  }
  if (exp.grants.length === 0) {
    add("INFO", "nenhum GRANT/REVOKE em migrations — nada a conferir");
  }
}

/**
 * Backfills de dados: nenhum catálogo registra se um UPDATE rodou, então a
 * única verificação possível é olhar os dados. Cada consulta devolve o número
 * de linhas que o backfill deveria ter corrigido — 0 significa aplicado.
 */
const BACKFILLS: { name: string; sql: string }[] = [
  {
    name: "LeanBudget.spentDecimal não backfilled (20260525000003)",
    sql: `SELECT COUNT(*)::int AS n FROM "LeanBudget"
            WHERE "spentDecimal" = 0 AND "spent" > 0`,
  },
  {
    name: "Epic.searchVector NULL (20260609000020)",
    sql: `SELECT COUNT(*)::int AS n FROM "Epic" WHERE "searchVector" IS NULL`,
  },
  {
    name: "Feature.searchVector NULL (20260609000020)",
    sql: `SELECT COUNT(*)::int AS n FROM "Feature" WHERE "searchVector" IS NULL`,
  },
  {
    name: 'Epic.lifecycleOrder divergente de "order" (20260724000031)',
    sql: `SELECT COUNT(*)::int AS n FROM "Epic"
            WHERE "lifecycleOrder" IS DISTINCT FROM "order"`,
  },
  {
    name: "copilot_messages.tenantId vazio (20260523100000)",
    sql: `SELECT COUNT(*)::int AS n FROM copilot_messages WHERE "tenantId" = ''`,
  },
];

async function auditBackfills() {
  for (const b of BACKFILLS) {
    try {
      const [row] = await q<{ n: number }>(b.sql);
      const n = Number(row?.n ?? 0);
      if (n > 0) {
        add("MISSING", `backfill: ${b.name} — ${n} linha(s)`);
      }
    } catch (e) {
      // Coluna/tabela pode ter sido removida por migration posterior — o
      // backfill vira irrelevante, mas o motivo fica registrado.
      add(
        "INFO",
        `backfill não verificável (${b.name}): ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

async function auditRls() {
  const [rls] = await q<{ enabled: number; forced: number; policies: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) AS enabled,
       (SELECT COUNT(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind='r' AND c.relforcerowsecurity) AS forced,
       (SELECT COUNT(*)::int FROM pg_policies WHERE schemaname='public') AS policies`
  );
  add(
    "INFO",
    `RLS vivo: enabled=${rls?.enabled} forced=${rls?.forced} policies=${rls?.policies}`
  );
}

const SEVERITY_ORDER = { MISSING: 0, DRIFT: 1, INFO: 2 } as const;

async function main() {
  const exp = collectExpected(loadStatements());

  await auditLedger();
  await auditFunctions(exp);
  await auditTriggers(exp);
  await auditConstraints(exp);
  await auditExtensionsAndGrants(exp);
  await auditBackfills();
  await auditRls();

  findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  for (const f of findings) {
    console.log(`[${f.severity}] ${f.detail}`);
  }
  const acionaveis = findings.filter((f) => f.severity !== "INFO").length;
  console.log(
    `\nesperado do disco: ${exp.functions.size} funções, ${exp.triggers.size} triggers, ${exp.fks.size} FKs, ${exp.checks.size} CHECKs, ${exp.extensions.size} extensões, ${exp.grants.length} grants`
  );
  console.log(`achados acionáveis: ${acionaveis}`);
  await pool.end();
  process.exit(acionaveis > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(2);
});
