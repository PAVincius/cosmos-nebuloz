# Período por intervalo e plano de contas editável — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os seletores de mês das telas CAC e Financeiro por um seletor de intervalo portado do date-range-picker-for-shadcn, ler DRE/CAC/caixa por intervalo, e transformar o plano de contas em tabela editável.

**Architecture:** Um lib puro de período (`periodo.ts`) traduz intervalo em competências/segundas com tetos. O plano de contas vira modelo `ContaDoPlano` semeado com as 27 contas; `calcularDre` passa a receber as contas e deriva as linhas (uma por conta nos grupos 1 e 3, uma por centro de custo nos grupos 4–6). As actions de Financeiro e CAC recebem `{ de, ate }` e devolvem a janela; as escritas devolvem a mesma janela. O seletor é um componente cliente (`SeletorDePeriodo`) sobre `Popover` e `Calendar` do `@repo/design-system`, com presets por aba, e o intervalo vive na URL.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Vitest 4 (jsdom por arquivo para o componente), zod 4, `@repo/design-system` (`components/ui/popover`, `components/ui/calendar` sobre react-day-picker 9, `date-fns/locale/pt-BR`), Biome.

**Spec:** [`docs/superpowers/specs/2026-09-06-periodo-e-plano-de-contas-design.md`](../specs/2026-09-06-periodo-e-plano-de-contas-design.md)

## Global Constraints

- Tenant `system` em toda query (`SYSTEM_TENANT_ID`); centavos `Int`; entrada `Int?`; nada calculado persistido; `requirePlatformStaff` → `assertCanWrite` → `safeAction` → zod → `logPlatformAudit` → `revalidatePath` em toda escrita.
- Intervalo = `{ de: "AAAA-MM-DD", ate: "AAAA-MM-DD" }`, sem hora nem fuso; estado de URL `?de&ate`; tetos 12 meses / 26 semanas recusam com mensagem, nunca truncam.
- Meses inteiros: as competências são os meses tocados pelo intervalo. Semanas: segundas-feiras UTC (`segundaFeira` de `lib/empresa/financeiro.ts`).
- `CONTAS_DO_CAC` (4.1–4.6) continua constante; `PLANO_DE_CONTAS` (27 contas) vira dado de seed em `packages/provisioning/src/plano-de-contas-nebuloz.ts`; `LINHAS_RECEITA/CUSTO/DESPESA` deixam de existir.
- Módulo `"use server"` só exporta funções async (constantes ficam locais; `type` pode).
- Comandos: teste escopado `cd apps/backoffice && npx vitest run __tests__/<arquivo>`; typecheck `cd apps/backoffice && npx tsc --noEmit --emitDeclarationOnly false`; lint SÓ nos arquivos próprios com `cd apps/backoffice && ./node_modules/.bin/biome check --write <arquivos>` (se o binário não existir ali, `../../node_modules/.bin/biome`). NUNCA `pnpm fix`/`pnpm check` na raiz. Stage só arquivos próprios. Usar `/usr/bin/grep`, `/usr/bin/git`.
- Commits em português, conventional commits, SEM trailer `Co-Authored-By`.
- Banco local: Docker `cosmos-e2e-db` porta 5434, `cosmos_dev` (`DATABASE_URL` de `apps/app/.env.local`). Nunca apontar comando para Supabase.
- A árvore de trabalho pode ter ~109 arquivos modificados alheios (formatador). Não tocar, não reverter, não stagear.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/backoffice/lib/empresa/periodo.ts` (+ teste) | Intervalo → competências/segundas, padrões, presets, rótulo, URL (Task 1) |
| `packages/database/prisma/schema/empresa.prisma`, `tenant.prisma`, migration `20260907000000_conta_do_plano` | Modelo `ContaDoPlano` (Task 2) |
| `packages/provisioning/src/plano-de-contas-nebuloz.ts` (+ teste), `apps/app/scripts/seed-empresa-nebuloz.ts` | 27 contas como seed (Task 2) |
| `apps/backoffice/lib/empresa/plano-de-contas.ts`, `lib/empresa/financeiro.ts` (+ testes) | Regras sem a lista; `calcularDre(contas, l)` (Task 3) |
| `apps/backoffice/components/entrada-de-data.tsx`, `components/seletor-de-periodo.tsx` (+ teste jsdom) | O seletor portado (Task 4) |
| `apps/backoffice/app/actions/empresa/financeiro.ts` (+ teste) | Plano de contas CRUD; DRE/caixa por intervalo (Task 5) |
| `apps/backoffice/app/actions/empresa/cac.ts` (+ teste) | CAC por intervalo (Task 6) |
| `app/(staff)/empresa/financeiro/{page,dre,caixa,plano}.tsx`, `app/(staff)/empresa/cac/{page,painel}.tsx` | Telas (Task 7) |
| `.claude/completions/2026-09-06-periodo-e-plano-de-contas.md`, SQL de seed para prod | Fechamento (Task 8) |

---

### Task 1: Lib de período

**Files:**
- Create: `apps/backoffice/lib/empresa/periodo.ts`
- Test: `apps/backoffice/__tests__/empresa-periodo.test.ts`

**Interfaces:**
- Consumes: `segundaFeira(d: Date): string` de `@/lib/empresa/financeiro`.
- Produces:
  - `type Intervalo = { de: string; ate: string }`
  - `type Preset = { id: string; rotulo: string; intervalo: (hoje: Date) => Intervalo }`
  - `class IntervaloExcedido extends Error` (mensagem em PT)
  - `intervaloValido(i: unknown): i is Intervalo`
  - `competenciasNoIntervalo(i: Intervalo): string[]` (teto 12)
  - `segundasNoIntervalo(i: Intervalo): string[]` (teto 26)
  - `intervaloPadraoCompetencia(hoje: Date): Intervalo`, `intervaloPadraoCaixa(hoje: Date): Intervalo`
  - `PRESETS_COMPETENCIA: Preset[]`, `PRESETS_CAIXA: Preset[]`
  - `rotuloDoIntervalo(i: Intervalo, presets: Preset[], hoje: Date): string`
  - `lerIntervaloDaUrl(params: { de?: string; ate?: string }, padrao: Intervalo): Intervalo`
  - `formatarDataBr(iso: string): string` (`dd/mm/aaaa`)
  - `TETO_MESES = 12`, `TETO_SEMANAS = 26`

- [ ] **Step 1: Teste**

```ts
// empresa-periodo.test.ts — o que o usuário escolhe são dias; o que a leitura
// usa são meses inteiros e segundas-feiras. Tetos recusam, não truncam.
import { describe, expect, it } from "vitest";
import {
  competenciasNoIntervalo,
  formatarDataBr,
  IntervaloExcedido,
  intervaloPadraoCaixa,
  intervaloPadraoCompetencia,
  intervaloValido,
  lerIntervaloDaUrl,
  PRESETS_CAIXA,
  PRESETS_COMPETENCIA,
  rotuloDoIntervalo,
  segundasNoIntervalo,
} from "../lib/empresa/periodo";

const HOJE = new Date("2026-09-06T15:00:00Z"); // domingo

describe("competenciasNoIntervalo", () => {
  it("lista os meses tocados, inclusive parciais", () => {
    expect(competenciasNoIntervalo({ de: "2026-07-01", ate: "2026-09-15" })).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(competenciasNoIntervalo({ de: "2026-09-06", ate: "2026-09-06" })).toEqual(["2026-09"]);
  });
  it("atravessa a virada de ano", () => {
    expect(competenciasNoIntervalo({ de: "2025-11-20", ate: "2026-01-03" })).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
  it("aceita 12 meses e recusa 13", () => {
    expect(competenciasNoIntervalo({ de: "2025-10-01", ate: "2026-09-30" })).toHaveLength(12);
    expect(() => competenciasNoIntervalo({ de: "2025-09-01", ate: "2026-09-30" })).toThrow(IntervaloExcedido);
  });
});

describe("segundasNoIntervalo", () => {
  it("começa na segunda da semana do `de` e vai até o `ate`", () => {
    expect(segundasNoIntervalo({ de: "2026-09-06", ate: "2026-09-20" })).toEqual(["2026-08-31", "2026-09-07", "2026-09-14"]);
  });
  it("aceita 26 semanas e recusa 27", () => {
    expect(segundasNoIntervalo({ de: "2026-08-31", ate: "2027-02-28" })).toHaveLength(26);
    expect(() => segundasNoIntervalo({ de: "2026-08-31", ate: "2027-03-07" })).toThrow(IntervaloExcedido);
  });
});

describe("padrões", () => {
  it("competência: últimos 3 meses, do dia 1 ao último dia do mês corrente", () => {
    expect(intervaloPadraoCompetencia(HOJE)).toEqual({ de: "2026-07-01", ate: "2026-09-30" });
  });
  it("caixa: da segunda corrente ao domingo da 13ª semana", () => {
    expect(intervaloPadraoCaixa(HOJE)).toEqual({ de: "2026-08-31", ate: "2026-11-29" });
  });
});

describe("presets e rótulo", () => {
  it("os presets de competência batem com os padrões", () => {
    const tres = PRESETS_COMPETENCIA.find((p) => p.id === "ultimos-3-meses");
    expect(tres?.intervalo(HOJE)).toEqual(intervaloPadraoCompetencia(HOJE));
    const mes = PRESETS_COMPETENCIA.find((p) => p.id === "este-mes");
    expect(mes?.intervalo(HOJE)).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
    const passado = PRESETS_COMPETENCIA.find((p) => p.id === "mes-passado");
    expect(passado?.intervalo(HOJE)).toEqual({ de: "2026-08-01", ate: "2026-08-31" });
    const tri = PRESETS_COMPETENCIA.find((p) => p.id === "trimestre-atual");
    expect(tri?.intervalo(HOJE)).toEqual({ de: "2026-07-01", ate: "2026-09-30" });
    const ano = PRESETS_COMPETENCIA.find((p) => p.id === "este-ano");
    expect(ano?.intervalo(HOJE)).toEqual({ de: "2026-01-01", ate: "2026-12-31" });
  });
  it("os presets de caixa", () => {
    expect(PRESETS_CAIXA.find((p) => p.id === "proximas-13")?.intervalo(HOJE)).toEqual(intervaloPadraoCaixa(HOJE));
    expect(PRESETS_CAIXA.find((p) => p.id === "proximas-26")?.intervalo(HOJE)).toEqual({ de: "2026-08-31", ate: "2027-02-28" });
  });
  it("rótulo usa o nome do preset quando bate, senão as datas", () => {
    expect(rotuloDoIntervalo({ de: "2026-07-01", ate: "2026-09-30" }, PRESETS_COMPETENCIA, HOJE)).toBe("Últimos 3 meses");
    expect(rotuloDoIntervalo({ de: "2026-07-03", ate: "2026-09-30" }, PRESETS_COMPETENCIA, HOJE)).toBe("03/07/2026 – 30/09/2026");
  });
});

describe("URL", () => {
  const padrao = { de: "2026-07-01", ate: "2026-09-30" };
  it("lê de/ate válidos", () => {
    expect(lerIntervaloDaUrl({ de: "2026-01-01", ate: "2026-02-28" }, padrao)).toEqual({ de: "2026-01-01", ate: "2026-02-28" });
  });
  it("ausente, inválido ou invertido cai no padrão", () => {
    expect(lerIntervaloDaUrl({}, padrao)).toEqual(padrao);
    expect(lerIntervaloDaUrl({ de: "ontem", ate: "2026-02-28" }, padrao)).toEqual(padrao);
    expect(lerIntervaloDaUrl({ de: "2026-03-01", ate: "2026-02-28" }, padrao)).toEqual(padrao);
    expect(intervaloValido({ de: "2026-02-30", ate: "2026-03-01" })).toBe(false);
  });
  it("formata dd/mm/aaaa", () => {
    expect(formatarDataBr("2026-09-06")).toBe("06/09/2026");
  });
});
```

- [ ] **Step 2: Rodar — deve falhar** (`cd apps/backoffice && npx vitest run __tests__/empresa-periodo.test.ts`)

- [ ] **Step 3: Implementar**

```ts
/**
 * Período por intervalo (spec 2026-09-06 §1–§3).
 *
 * O usuário escolhe dias; as leituras usam os meses tocados (DRE, CAC) ou as
 * segundas-feiras contidas (caixa). Tetos recusam com erro nomeado — truncar
 * em silêncio mostraria um total de menos meses com cara de total.
 */
import { segundaFeira } from "./financeiro";

export type Intervalo = { de: string; ate: string };
export type Preset = { id: string; rotulo: string; intervalo: (hoje: Date) => Intervalo };

export const TETO_MESES = 12;
export const TETO_SEMANAS = 26;

export class IntervaloExcedido extends Error {
  constructor(teto: number, unidade: "meses" | "semanas") {
    super(`O intervalo passa de ${teto} ${unidade}. Escolha um período menor.`);
    this.name = "IntervaloExcedido";
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 86_400_000;

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function dataValida(s: string): boolean {
  return ISO.test(s) && iso(utc(s)) === s;
}

export function intervaloValido(i: unknown): i is Intervalo {
  if (typeof i !== "object" || i === null) {
    return false;
  }
  const { de, ate } = i as Record<string, unknown>;
  return typeof de === "string" && typeof ate === "string" && dataValida(de) && dataValida(ate) && de <= ate;
}

export function competenciasNoIntervalo(i: Intervalo): string[] {
  const [a1, m1] = i.de.split("-").map(Number);
  const [a2, m2] = i.ate.split("-").map(Number);
  const total = (a2 - a1) * 12 + (m2 - m1) + 1;
  if (total > TETO_MESES) {
    throw new IntervaloExcedido(TETO_MESES, "meses");
  }
  return Array.from({ length: total }, (_, k) => {
    const d = new Date(Date.UTC(a1, m1 - 1 + k, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function segundasNoIntervalo(i: Intervalo): string[] {
  const primeira = utc(segundaFeira(utc(i.de)));
  const fim = utc(i.ate);
  const out: string[] = [];
  for (let d = primeira; d <= fim; d = new Date(d.getTime() + 7 * DIA_MS)) {
    out.push(iso(d));
    if (out.length > TETO_SEMANAS) {
      throw new IntervaloExcedido(TETO_SEMANAS, "semanas");
    }
  }
  return out;
}

function inicioDoMes(ano: number, mes0: number): string {
  return iso(new Date(Date.UTC(ano, mes0, 1)));
}
function fimDoMes(ano: number, mes0: number): string {
  return iso(new Date(Date.UTC(ano, mes0 + 1, 0)));
}

export function intervaloPadraoCompetencia(hoje: Date): Intervalo {
  const a = hoje.getUTCFullYear();
  const m = hoje.getUTCMonth();
  return { de: inicioDoMes(a, m - 2), ate: fimDoMes(a, m) };
}

export function intervaloPadraoCaixa(hoje: Date): Intervalo {
  const de = segundaFeira(hoje);
  const ate = new Date(utc(de).getTime() + (13 * 7 - 1) * DIA_MS);
  return { de, ate: iso(ate) };
}

export const PRESETS_COMPETENCIA: Preset[] = [
  { id: "este-mes", rotulo: "Este mês", intervalo: (h) => ({ de: inicioDoMes(h.getUTCFullYear(), h.getUTCMonth()), ate: fimDoMes(h.getUTCFullYear(), h.getUTCMonth()) }) },
  { id: "mes-passado", rotulo: "Mês passado", intervalo: (h) => ({ de: inicioDoMes(h.getUTCFullYear(), h.getUTCMonth() - 1), ate: fimDoMes(h.getUTCFullYear(), h.getUTCMonth() - 1) }) },
  { id: "ultimos-3-meses", rotulo: "Últimos 3 meses", intervalo: intervaloPadraoCompetencia },
  {
    id: "trimestre-atual",
    rotulo: "Trimestre atual",
    intervalo: (h) => {
      const inicio = Math.floor(h.getUTCMonth() / 3) * 3;
      return { de: inicioDoMes(h.getUTCFullYear(), inicio), ate: fimDoMes(h.getUTCFullYear(), inicio + 2) };
    },
  },
  { id: "este-ano", rotulo: "Este ano", intervalo: (h) => ({ de: inicioDoMes(h.getUTCFullYear(), 0), ate: fimDoMes(h.getUTCFullYear(), 11) }) },
];

export const PRESETS_CAIXA: Preset[] = [
  { id: "proximas-13", rotulo: "Próximas 13 semanas", intervalo: intervaloPadraoCaixa },
  {
    id: "proximas-26",
    rotulo: "Próximas 26 semanas",
    intervalo: (h) => {
      const de = segundaFeira(h);
      return { de, ate: iso(new Date(utc(de).getTime() + (26 * 7 - 1) * DIA_MS)) };
    },
  },
  {
    id: "este-trimestre",
    rotulo: "Este trimestre",
    intervalo: (h) => {
      const inicio = Math.floor(h.getUTCMonth() / 3) * 3;
      return { de: inicioDoMes(h.getUTCFullYear(), inicio), ate: fimDoMes(h.getUTCFullYear(), inicio + 2) };
    },
  },
];

export function formatarDataBr(isoData: string): string {
  const [a, m, d] = isoData.split("-");
  return `${d}/${m}/${a}`;
}

export function rotuloDoIntervalo(i: Intervalo, presets: Preset[], hoje: Date): string {
  const p = presets.find((x) => {
    const r = x.intervalo(hoje);
    return r.de === i.de && r.ate === i.ate;
  });
  return p ? p.rotulo : `${formatarDataBr(i.de)} – ${formatarDataBr(i.ate)}`;
}

export function lerIntervaloDaUrl(params: { de?: string; ate?: string }, padrao: Intervalo): Intervalo {
  const candidato = { de: params.de, ate: params.ate };
  return intervaloValido(candidato) ? candidato : padrao;
}
```

- [ ] **Step 4: Rodar — deve passar; Biome no arquivo; commit**

```bash
/usr/bin/git add apps/backoffice/lib/empresa/periodo.ts apps/backoffice/__tests__/empresa-periodo.test.ts
/usr/bin/git commit -m "feat(backoffice): lib de período — intervalo vira competências e segundas, com tetos e presets"
```

---

### Task 2: `ContaDoPlano` — modelo, migration e seed

**Files:**
- Modify: `packages/database/prisma/schema/empresa.prisma` (adicionar o modelo ao fim da seção Financeiro)
- Modify: `packages/database/prisma/schema/tenant.prisma` (retro-relação `contasDoPlano ContaDoPlano[] @relation("ContaDoPlanoSystemTenant")` no bloco Empresa)
- Create: `packages/database/prisma/migrations/20260907000000_conta_do_plano/migration.sql`
- Create: `packages/provisioning/src/plano-de-contas-nebuloz.ts`
- Test: `packages/provisioning/src/__tests__/plano-de-contas-nebuloz.test.ts`
- Modify: `apps/app/scripts/seed-empresa-nebuloz.ts`

**Interfaces:**
- Produces: `database.contaDoPlano` (unique `tenantId_conta`); `PLANO_DE_CONTAS_NEBULOZ: ContaSeed[]` com `type ContaSeed = { conta: string; nome: string; grupo: 1|2|3|4|5|6; centroDeCusto: "comercial"|"produto-engenharia"|"entrega"|"ga"|null; ordem: number }` (27 itens, `ordem` = índice); o seed `seed:empresa:nebuloz` também cria as contas (create-only).

- [ ] **Step 1: Modelo** — o bloco Prisma da spec §4.1, literal, ao fim de `empresa.prisma` (seção Financeiro). Retro-relação em `Tenant`.

- [ ] **Step 2: Migration** — `cd packages/database && npx prisma format && npx prisma validate && npx prisma generate --no-hints`, depois `npx prisma migrate dev --create-only --name conta_do_plano` (renomear a pasta para `20260907000000_conta_do_plano`; fallback `migrate diff --from-migrations … --to-schema prisma/schema --shadow-database-url` como no plano anterior). Anexar o bloco de RLS para a tabela `ContaDoPlano` (mesmo `DO $$` de `20260906000000_empresa`, com a lista `ARRAY['ContaDoPlano']`). `npx prisma migrate deploy` no banco local e `migrate diff --from-config-datasource --to-schema prisma/schema --exit-code` limpo.

- [ ] **Step 3: Dado de seed + teste**

```ts
// packages/provisioning/src/__tests__/plano-de-contas-nebuloz.test.ts
import { describe, expect, it } from "vitest";
import { PLANO_DE_CONTAS_NEBULOZ } from "../plano-de-contas-nebuloz";

describe("plano de contas", () => {
  it("27 contas, códigos únicos no formato N.N, grupos 1..6 com centro coerente", () => {
    expect(PLANO_DE_CONTAS_NEBULOZ).toHaveLength(27);
    expect(new Set(PLANO_DE_CONTAS_NEBULOZ.map((c) => c.conta)).size).toBe(27);
    for (const c of PLANO_DE_CONTAS_NEBULOZ) {
      expect(c.conta).toMatch(/^\d\.\d{1,2}$/);
      expect(Number(c.conta[0])).toBe(c.grupo);
      if (c.grupo <= 2) expect(c.centroDeCusto).toBeNull();
      if (c.grupo === 3) expect(c.centroDeCusto).toBe("entrega");
      if (c.grupo === 4) expect(c.centroDeCusto).toBe("comercial");
      if (c.grupo === 5) expect(c.centroDeCusto).toBe("produto-engenharia");
      if (c.grupo === 6) expect(c.centroDeCusto).toBe("ga");
    }
  });
});
```

`plano-de-contas-nebuloz.ts`: cabeçalho de proveniência (docs/financeiro/plano-de-contas.md; veio de `apps/backoffice/lib/empresa/plano-de-contas.ts`), o tipo `ContaSeed` e as 27 entradas copiadas **exatamente** de `PLANO_DE_CONTAS` em `apps/backoffice/lib/empresa/plano-de-contas.ts` (código, nome, grupo, centroDeCusto), com `ordem` = posição (0..26). Não apagar ainda a constante do back-office — a Task 3 faz isso.

- [ ] **Step 4: Seed** — em `apps/app/scripts/seed-empresa-nebuloz.ts`, importar `PLANO_DE_CONTAS_NEBULOZ` de `@repo/provisioning/src/plano-de-contas-nebuloz` e acrescentar, após as perguntas:

```ts
  const c = await db.contaDoPlano.createMany({
    skipDuplicates: true,
    data: PLANO_DE_CONTAS_NEBULOZ.map((x) => ({ tenantId: SYSTEM_TENANT_ID, ...x })),
  });
  console.log(`  ✓ plano de contas: ${c.count} criadas (${PLANO_DE_CONTAS_NEBULOZ.length - c.count} já existiam)`);
```

Rodar `pnpm --filter app seed:empresa:nebuloz` duas vezes no banco local: `27 criadas` depois `0 criadas`. Atualizar o cabeçalho do script (lista o que semeia).

- [ ] **Step 5: Verificar e commitar**

```bash
cd packages/provisioning && npx vitest run src/__tests__/plano-de-contas-nebuloz.test.ts && npx tsc --noEmit --emitDeclarationOnly false
cd ../database && npx tsc --noEmit --emitDeclarationOnly false
/usr/bin/git add packages/database/prisma/schema/empresa.prisma packages/database/prisma/schema/tenant.prisma packages/database/prisma/migrations/20260907000000_conta_do_plano packages/provisioning/src/plano-de-contas-nebuloz.ts packages/provisioning/src/__tests__/plano-de-contas-nebuloz.test.ts apps/app/scripts/seed-empresa-nebuloz.ts
/usr/bin/git commit -m "feat(database): plano de contas vira tabela ContaDoPlano, semeada com as 27 contas"
```

---

### Task 3: Libs sem a lista — `plano-de-contas.ts` e `calcularDre(contas, l)`

**Files:**
- Modify: `apps/backoffice/lib/empresa/plano-de-contas.ts` (reescrever)
- Modify: `apps/backoffice/lib/empresa/financeiro.ts` (`calcularDre` e helpers; resto intacto)
- Modify: `apps/backoffice/__tests__/empresa-plano-de-contas.test.ts` (reescrever)
- Modify: `apps/backoffice/__tests__/empresa-financeiro.test.ts` (só os testes de `calcularDre`/`somarMeses` mudam de assinatura)

**Interfaces:**
- Produces (`plano-de-contas.ts`): `type Grupo`, `type CentroDeCusto`, `type Conta = { conta: string; nome: string; grupo: Grupo; centroDeCusto: CentroDeCusto | null; ativa: boolean }`, `CONTAS_DO_CAC`, `ContaDoCac`, `contaValida(codigo): boolean` (formato `^\d\.\d{1,2}$`), `grupoDoCodigo(codigo): Grupo | null` (primeiro dígito, 1–6), `centroDoGrupo(grupo): CentroDeCusto | null`, `ROTULO_CENTRO: Record<CentroDeCusto, string>` (`comercial`→"Comercial", `produto-engenharia`→"Produto e engenharia", `entrega`→"Entrega", `ga`→"G&A").
- Produces (`financeiro.ts`): `calcularDre(contas: Conta[], l: LancamentosDoMes): LinhaCalculada[]`. Linhas, na ordem: uma por conta do grupo 1 (id `c-<conta>`, rótulo = nome; conta inativa só entra se `l[conta] !== undefined`, com sufixo " (desativada)"); `receita-bruta`; `deducoes` (soma do grupo 2, mesma regra de inativa); `receita-liquida`; uma por conta do grupo 3 (`c-<conta>`); `custo-total`; `margem-bruta`; `margem-bruta-pct`; uma por centro de custo (`comercial`, `produto`, `ga`, rótulos de `ROTULO_CENTRO`, somando as contas ativas do grupo 4/5/6 mais as inativas com lançamento — linha ausente se o centro não tiver conta nenhuma); `despesas-total`; `ebitda`; `ebitda-pct`. Semântica de nulo inalterada. `somarMeses` inalterada.

- [ ] **Step 1: Testes**

`empresa-plano-de-contas.test.ts` (substitui o antigo):

```ts
import { describe, expect, it } from "vitest";
import { centroDoGrupo, CONTAS_DO_CAC, contaValida, grupoDoCodigo } from "../lib/empresa/plano-de-contas";

describe("plano de contas — regras", () => {
  it("valida o formato N.N ou N.NN, não a existência", () => {
    expect(contaValida("1.1")).toBe(true);
    expect(contaValida("4.12")).toBe(true);
    expect(contaValida("10.1")).toBe(false);
    expect(contaValida("1")).toBe(false);
    expect(contaValida("")).toBe(false);
  });
  it("grupo é o primeiro dígito, 1..6", () => {
    expect(grupoDoCodigo("4.7")).toBe(4);
    expect(grupoDoCodigo("7.1")).toBeNull();
  });
  it("centro de custo deriva do grupo", () => {
    expect(centroDoGrupo(1)).toBeNull();
    expect(centroDoGrupo(3)).toBe("entrega");
    expect(centroDoGrupo(4)).toBe("comercial");
    expect(centroDoGrupo(5)).toBe("produto-engenharia");
    expect(centroDoGrupo(6)).toBe("ga");
  });
  it("as seis contas do CAC continuam fixas", () => {
    expect([...CONTAS_DO_CAC]).toEqual(["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"]);
  });
});
```

Em `empresa-financeiro.test.ts`, trocar o bloco `calcularDre`/`somarMeses` por este (o resto do arquivo — competências, caixa — fica):

```ts
import type { Conta } from "../lib/empresa/plano-de-contas";

const conta = (c: string, nome: string, grupo: Conta["grupo"], centro: Conta["centroDeCusto"], ativa = true): Conta => ({ conta: c, nome, grupo, centroDeCusto: centro, ativa });
const CONTAS: Conta[] = [
  conta("1.1", "Assinatura A", 1, null), conta("1.2", "Assinatura B", 1, null),
  conta("2.1", "Impostos", 2, null),
  conta("3.1", "Entrega A", 3, "entrega"),
  conta("4.1", "Vendas", 4, "comercial"), conta("4.7", "Eventos", 4, "comercial"),
  conta("5.1", "Engenharia", 5, "produto-engenharia"),
  conta("6.1", "Admin", 6, "ga"),
];
const MES: Record<string, number> = { "1.1": 1000, "1.2": 500, "2.1": 100, "3.1": 300, "4.1": 100, "4.7": 50, "5.1": 200, "6.1": 100 };

function linha(dre: ReturnType<typeof calcularDre>, id: string) {
  const l = dre.find((x) => x.id === id);
  if (!l) throw new Error(`linha ${id} ausente`);
  return l;
}

describe("calcularDre com contas dinâmicas", () => {
  it("uma linha por conta de receita e de custo; uma por centro nas despesas", () => {
    const dre = calcularDre(CONTAS, MES);
    expect(dre.map((l) => l.id)).toEqual([
      "c-1.1", "c-1.2", "receita-bruta", "deducoes", "receita-liquida",
      "c-3.1", "custo-total", "margem-bruta", "margem-bruta-pct",
      "comercial", "produto", "ga", "despesas-total", "ebitda", "ebitda-pct",
    ]);
    expect(linha(dre, "receita-bruta").valorCentavos).toBe(1500);
    expect(linha(dre, "receita-liquida").valorCentavos).toBe(1400);
    expect(linha(dre, "comercial").valorCentavos).toBe(150); // 4.1 + a conta nova 4.7
    expect(linha(dre, "despesas-total").valorCentavos).toBe(450);
    expect(linha(dre, "ebitda").valorCentavos).toBe(650);
    expect(linha(dre, "ebitda-pct").percent).toBe(46);
  });
  it("conta ativa sem lançamento anula a linha agregada; conta inativa sem lançamento é ignorada", () => {
    const { "4.7": _x, ...semEventos } = MES;
    expect(linha(calcularDre(CONTAS, semEventos), "comercial").valorCentavos).toBeNull();
    const inativa = CONTAS.map((c) => (c.conta === "4.7" ? { ...c, ativa: false } : c));
    expect(linha(calcularDre(inativa, semEventos), "comercial").valorCentavos).toBe(100);
  });
  it("conta inativa com lançamento entra, marcada", () => {
    const inativa = CONTAS.map((c) => (c.conta === "1.2" ? { ...c, ativa: false } : c));
    const dre = calcularDre(inativa, MES);
    expect(linha(dre, "c-1.2").rotulo).toBe("Assinatura B (desativada)");
    expect(linha(dre, "receita-bruta").valorCentavos).toBe(1500);
  });
  it("centro sem conta não gera linha; percentual nulo com receita zero", () => {
    const semGa = CONTAS.filter((c) => c.grupo !== 6);
    expect(calcularDre(semGa, MES).some((l) => l.id === "ga")).toBe(false);
    const zero = Object.fromEntries(Object.keys(MES).map((k) => [k, 0]));
    expect(linha(calcularDre(CONTAS, zero), "ebitda-pct").percent).toBeNull();
  });
});

describe("somarMeses", () => {
  it("soma linha a linha e propaga nulo", () => {
    const a = calcularDre(CONTAS, MES);
    expect(linha(somarMeses([a, a, a]), "ebitda").valorCentavos).toBe(1950);
    expect(linha(somarMeses([a, calcularDre(CONTAS, {})]), "ebitda").valorCentavos).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — devem falhar** (`npx vitest run __tests__/empresa-plano-de-contas.test.ts __tests__/empresa-financeiro.test.ts`).

- [ ] **Step 3: Implementar `plano-de-contas.ts`**

```ts
/**
 * Regras do plano de contas. A lista das 27 contas mora no banco
 * (ContaDoPlano, semeada de packages/provisioning/src/plano-de-contas-nebuloz.ts)
 * desde 6 set — a operação abre conta sem deploy. Aqui fica só o que é regra.
 */

export type Grupo = 1 | 2 | 3 | 4 | 5 | 6;
export type CentroDeCusto = "comercial" | "produto-engenharia" | "entrega" | "ga";

export type Conta = {
  conta: string;
  nome: string;
  grupo: Grupo;
  centroDeCusto: CentroDeCusto | null;
  ativa: boolean;
};

/** As seis parcelas do CAC que são contas do DRE (cac-modelo.md §2). Fixas:
 *  são o vínculo com o modelo de CAC, não o plano. */
export const CONTAS_DO_CAC = ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] as const;
export type ContaDoCac = (typeof CONTAS_DO_CAC)[number];

const FORMATO = /^[1-6]\.\d{1,2}$/;

export function contaValida(codigo: string): boolean {
  return FORMATO.test(codigo);
}

export function grupoDoCodigo(codigo: string): Grupo | null {
  return contaValida(codigo) ? (Number(codigo[0]) as Grupo) : null;
}

export function centroDoGrupo(grupo: Grupo): CentroDeCusto | null {
  switch (grupo) {
    case 3: return "entrega";
    case 4: return "comercial";
    case 5: return "produto-engenharia";
    case 6: return "ga";
    default: return null;
  }
}

export const ROTULO_CENTRO: Record<CentroDeCusto, string> = {
  comercial: "Comercial",
  "produto-engenharia": "Produto e engenharia",
  entrega: "Entrega",
  ga: "G&A",
};
```

(Nota: o teste aceita `"10.1"` como inválido e `"1"` como inválido — `[1-6]` cobre; `grupoDoCodigo("7.1")` é nulo porque o formato recusa.)

- [ ] **Step 4: Implementar em `financeiro.ts`** — substituir o import de `plano-de-contas`, `agregadas` e `calcularDre`:

```ts
import { type CentroDeCusto, type Conta, ROTULO_CENTRO } from "./plano-de-contas";

/** Contas que entram no mês: ativas sempre; inativas só quando têm lançamento. */
function contasDoMes(contas: Conta[], l: LancamentosDoMes, grupo: Conta["grupo"]): Conta[] {
  return contas.filter((c) => c.grupo === grupo && (c.ativa || l[c.conta] !== undefined));
}

function rotulo(c: Conta): string {
  return c.ativa ? c.nome : `${c.nome} (desativada)`;
}

function linhasPorConta(contas: Conta[], l: LancamentosDoMes, grupo: Conta["grupo"]): LinhaCalculada[] {
  return contasDoMes(contas, l, grupo).map((c) => ({
    id: `c-${c.conta}`,
    rotulo: rotulo(c),
    valorCentavos: l[c.conta] ?? null,
    calculada: false,
  }));
}

const CENTROS: { id: string; centro: CentroDeCusto; grupo: Conta["grupo"] }[] = [
  { id: "comercial", centro: "comercial", grupo: 4 },
  { id: "produto", centro: "produto-engenharia", grupo: 5 },
  { id: "ga", centro: "ga", grupo: 6 },
];

function linhasPorCentro(contas: Conta[], l: LancamentosDoMes): LinhaCalculada[] {
  return CENTROS.flatMap(({ id, centro, grupo }) => {
    const doCentro = contasDoMes(contas, l, grupo);
    if (doCentro.length === 0) {
      return [];
    }
    return [{ id, rotulo: ROTULO_CENTRO[centro], valorCentavos: somaContas(l, doCentro.map((c) => c.conta)), calculada: false }];
  });
}

/** As linhas do DRE, derivadas das contas do plano (spec 2026-09-06 §4.3). */
export function calcularDre(contas: Conta[], l: LancamentosDoMes): LinhaCalculada[] {
  const receita = linhasPorConta(contas, l, 1);
  const receitaBruta = soma(receita.map((x) => x.valorCentavos));
  const deducoes = somaContas(l, contasDoMes(contas, l, 2).map((c) => c.conta));
  const receitaLiquida = sub(receitaBruta, deducoes);

  const custo = linhasPorConta(contas, l, 3);
  const custoTotal = soma(custo.map((x) => x.valorCentavos));
  const margemBruta = sub(receitaLiquida, custoTotal);

  const despesa = linhasPorCentro(contas, l);
  const despesasTotal = soma(despesa.map((x) => x.valorCentavos));
  const ebitda = sub(margemBruta, despesasTotal);
  // … `calc`, `pctLinha` e o `return [...]` como hoje, com `...receita`, `...custo`, `...despesa`.
}
```

`somaContas` com lista vazia devolve `0` (soma de nada) — é o comportamento certo para "grupo 2 sem conta": deduções zero, não nulas. `contasDoGrupo` e `LINHAS_*` somem do arquivo e do import.

- [ ] **Step 5: Rodar os dois testes — passar; typecheck vai QUEBRAR em `actions/empresa/financeiro.ts` e `cac.ts` (importam `PLANO_DE_CONTAS`/`contaValida` antigo)** — esperado: as Tasks 5 e 6 corrigem. Para o commit desta task passar no hook, o `tsc` não roda no pre-commit (só lint-staged/Biome). Confirmar que `npx vitest run __tests__/empresa-plano-de-contas.test.ts __tests__/empresa-financeiro.test.ts __tests__/empresa-cac.test.ts` passa (o lib do CAC só usa `CONTAS_DO_CAC`).

- [ ] **Step 6: Commit**

```bash
/usr/bin/git add apps/backoffice/lib/empresa/plano-de-contas.ts apps/backoffice/lib/empresa/financeiro.ts apps/backoffice/__tests__/empresa-plano-de-contas.test.ts apps/backoffice/__tests__/empresa-financeiro.test.ts
/usr/bin/git commit -m "refactor(backoffice): DRE derivado das contas do plano — uma linha por conta, uma por centro de custo"
```

---

### Task 4: `EntradaDeData` e `SeletorDePeriodo`

**Files:**
- Create: `apps/backoffice/components/entrada-de-data.tsx`
- Create: `apps/backoffice/components/seletor-de-periodo.tsx`
- Test: `apps/backoffice/__tests__/seletor-de-periodo.test.tsx` (`// @vitest-environment jsdom` no topo, como `confirmar-acao.test.tsx`)

**Interfaces:**
- Consumes: `Popover`, `PopoverTrigger`, `PopoverContent` de `@repo/design-system/components/ui/popover`; `Calendar` de `@repo/design-system/components/ui/calendar` (props de `react-day-picker` v9: `mode="range"`, `selected`, `onSelect`, `numberOfMonths`, `locale`, `defaultMonth`); `ptBR` de `date-fns/locale` (dependência do design-system — se `apps/backoffice` não resolver `date-fns`, adicionar `"date-fns": "^4.1.0"` em `apps/backoffice/package.json` e `pnpm install --filter backoffice`); `Intervalo`, `Preset`, `rotuloDoIntervalo`, `formatarDataBr`, `intervaloValido` (Task 1).
- Produces:
  - `EntradaDeData({ valor: string; onChange: (iso: string) => void; rotulo: string })` — três `<input inputMode="numeric">` dia/mês/ano com validação como o original (só dígitos, setas sobem/descem, Tab avança, blur inválido restaura); chama `onChange` só com data válida, em ISO.
  - `SeletorDePeriodo({ valor: Intervalo; presets: Preset[]; onAplicar: (i: Intervalo) => void; align?: "start" | "center" | "end" })` — gatilho `.btn` com `rotuloDoIntervalo`; conteúdo: coluna de presets (botão por preset, `aria-pressed` no que bate), duas `EntradaDeData`, `Calendar mode="range"` (2 meses; 1 se `window.matchMedia("(max-width: 900px)")`), rodapé "Cancelar"/"Aplicar". Aplicar fecha e chama `onAplicar` só se mudou; Cancelar restaura o `valor`. Estado interno reseta ao abrir.

- [ ] **Step 1: Teste (jsdom)**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SeletorDePeriodo } from "../components/seletor-de-periodo";
import { PRESETS_COMPETENCIA } from "../lib/empresa/periodo";

vi.mock("@repo/design-system/components/ui/calendar", () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

describe("SeletorDePeriodo", () => {
  const valor = { de: "2026-07-01", ate: "2026-09-30" };

  it("mostra o rótulo do preset no gatilho e abre com os presets", () => {
    render(<SeletorDePeriodo onAplicar={() => {}} presets={PRESETS_COMPETENCIA} valor={valor} />);
    const gatilho = screen.getByRole("button", { name: /Últimos 3 meses/ });
    fireEvent.click(gatilho);
    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
    expect(screen.getByTestId("calendar")).toBeTruthy();
  });

  it("preset + Aplicar chama onAplicar com o intervalo do preset", () => {
    const onAplicar = vi.fn();
    render(<SeletorDePeriodo onAplicar={onAplicar} presets={PRESETS_COMPETENCIA} valor={valor} />);
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    fireEvent.click(screen.getByRole("button", { name: "Este ano" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    const ano = new Date().getUTCFullYear();
    expect(onAplicar).toHaveBeenCalledWith({ de: `${ano}-01-01`, ate: `${ano}-12-31` });
  });

  it("Aplicar sem mudança não chama onAplicar; Cancelar descarta", () => {
    const onAplicar = vi.fn();
    render(<SeletorDePeriodo onAplicar={onAplicar} presets={PRESETS_COMPETENCIA} valor={valor} />);
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onAplicar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onAplicar).not.toHaveBeenCalled();
  });

  it("data digitada inválida não muda o intervalo", () => {
    const onAplicar = vi.fn();
    render(<SeletorDePeriodo onAplicar={onAplicar} presets={PRESETS_COMPETENCIA} valor={valor} />);
    fireEvent.click(screen.getByRole("button", { name: /Últimos 3 meses/ }));
    const dia = screen.getByLabelText("Início — dia");
    fireEvent.change(dia, { target: { value: "31" } }); // 31/07 é válido
    fireEvent.change(screen.getByLabelText("Início — mês"), { target: { value: "02" } }); // 31/02 inválido → não aplica
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onAplicar).toHaveBeenCalledWith({ de: "2026-07-31", ate: "2026-09-30" });
  });
});
```

Se o `Popover` do Radix não renderizar o conteúdo no jsdom sem `act`/portal, envolver o `PopoverContent` em `forceMount` só em teste NÃO é aceitável — em vez disso, no teste, mockar `@repo/design-system/components/ui/popover` com componentes que renderizam `children` direto (`Popover` guarda `open` em estado e renderiza `PopoverContent` quando aberto; `PopoverTrigger` é um botão que alterna). Documentar no report qual dos dois caminhos foi necessário.

- [ ] **Step 2: Rodar — deve falhar.**

- [ ] **Step 3: Implementar `entrada-de-data.tsx`** — porte do `DateInput` original em PT-BR: estado `{ dia, mes, ano }` derivado de `valor` (ISO) e resincronizado em `useEffect([valor])`; `validar(campo, n)` como o original (1–31, 1–12, 1000–9999, e a data real existe); `onChange` dispara só com data válida, em `AAAA-MM-DD` (zero à esquerda); `onBlur` inválido restaura o último válido; `onKeyDown` só dígitos e teclas de navegação, `ArrowUp/Down` incrementam com rollover (dia 31→1 e mês +1, como o original), `ArrowRight` no fim do campo pula para o próximo, `Tab` normal. Três inputs com `aria-label={`${rotulo} — dia`}`, `— mês`, `— ano`, `inputMode="numeric"`, largura 2/2/4 caracteres, estilo `INPUT` de `@/components/campo` com padding reduzido, separadores "/" em `<span>`.

- [ ] **Step 4: Implementar `seletor-de-periodo.tsx`**

```tsx
"use client";

import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { EntradaDeData } from "@/components/entrada-de-data";
import { type Intervalo, intervaloValido, type Preset, rotuloDoIntervalo } from "@/lib/empresa/periodo";

/**
 * Seletor de intervalo — porte do date-range-picker-for-shadcn (johnpolacek)
 * para a paleta do back-office: presets em coluna, entrada digitada, calendário
 * de dois meses. Sem "comparar" (spec 2026-09-06 §2). Controlado: `valor` vem
 * da URL; `onAplicar` só dispara quando o intervalo muda.
 */

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function paraRange(i: Intervalo): DateRange {
  // Datas locais ao meio-dia: o react-day-picker compara em horário local, e
  // um Date UTC à meia-noite vira "ontem" a oeste de Greenwich.
  return { from: new Date(`${i.de}T12:00:00`), to: new Date(`${i.ate}T12:00:00`) };
}

export function SeletorDePeriodo({ valor, presets, onAplicar, align = "end" }: {
  valor: Intervalo;
  presets: Preset[];
  onAplicar: (i: Intervalo) => void;
  align?: "start" | "center" | "end";
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Intervalo>(valor);
  const [estreito, setEstreito] = useState(false);
  const hoje = new Date();

  useEffect(() => {
    if (aberto) {
      setRascunho(valor);
    }
  }, [aberto, valor]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(max-width: 900px)");
    const aplicar = () => setEstreito(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  const aplicar = () => {
    setAberto(false);
    if (rascunho.de !== valor.de || rascunho.ate !== valor.ate) {
      onAplicar(rascunho);
    }
  };

  const presetAtivo = (p: Preset) => {
    const r = p.intervalo(hoje);
    return r.de === rascunho.de && r.ate === rascunho.ate;
  };

  return (
    <Popover onOpenChange={setAberto} open={aberto}>
      <PopoverTrigger asChild>
        <button className="btn" style={GATILHO} type="button">
          {rotuloDoIntervalo(valor, presets, hoje)}
          <span aria-hidden style={{ opacity: 0.6 }}>▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} style={PAINEL}>
        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 170 }}>
            {presets.map((p) => (
              <button aria-pressed={presetAtivo(p)} className="btn" key={p.id} onClick={() => setRascunho(p.intervalo(hoje))} style={{ ...PRESET, ...(presetAtivo(p) ? PRESET_ATIVO : {}) }} type="button">
                {p.rotulo}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <EntradaDeData onChange={(de) => setRascunho((r) => (de <= r.ate ? { ...r, de } : { de, ate: de }))} rotulo="Início" valor={rascunho.de} />
              <span style={{ color: "var(--ink-faint)" }}>–</span>
              <EntradaDeData onChange={(ate) => setRascunho((r) => (ate >= r.de ? { ...r, ate } : { de: ate, ate }))} rotulo="Fim" valor={rascunho.ate} />
            </div>
            <Calendar
              defaultMonth={utc(rascunho.de)}
              locale={ptBR}
              mode="range"
              numberOfMonths={estreito ? 1 : 2}
              onSelect={(r) => {
                if (r?.from) {
                  const de = iso(r.from);
                  const ate = r.to ? iso(r.to) : de;
                  const candidato = { de, ate };
                  if (intervaloValido(candidato)) {
                    setRascunho(candidato);
                  }
                }
              }}
              selected={paraRange(rascunho)}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button className="btn" onClick={() => setAberto(false)} style={SECUNDARIO} type="button">Cancelar</button>
          <button className="btn" onClick={aplicar} style={PRIMARIO} type="button">Aplicar</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const GATILHO = { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "inherit", fontSize: "var(--fs-base)", fontWeight: 600, cursor: "pointer" } as const;
const PAINEL = { width: "auto", padding: 14, background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)", boxShadow: "var(--card-shadow)", color: "var(--ink)" } as const;
const PRESET = { textAlign: "left", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid transparent", background: "none", color: "var(--ink-muted)", fontFamily: "inherit", fontSize: "var(--fs-nota)", fontWeight: 600, cursor: "pointer" } as const;
const PRESET_ATIVO = { background: "var(--accent-soft)", borderColor: "rgba(var(--accent-rgb),.45)", color: "var(--ink)" } as const;
const SECUNDARIO = { padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface-2)", color: "var(--ink-muted)", fontFamily: "inherit", fontSize: "var(--fs-nota)", fontWeight: 600, cursor: "pointer" } as const;
const PRIMARIO = { ...SECUNDARIO, background: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-fg)" } as const;
```

O `Calendar` do kit vem com classes Tailwind do tema shadcn; dentro do back-office (tema escuro, `.cosmos-root`) confirmar visualmente na Task 8 que o fundo e o texto ficam legíveis — se não, passar `className` com `bg-[var(--surface)] text-[var(--ink)]`.

- [ ] **Step 5: Rodar o teste jsdom, tsc, Biome; commit**

```bash
/usr/bin/git add apps/backoffice/components/entrada-de-data.tsx apps/backoffice/components/seletor-de-periodo.tsx apps/backoffice/__tests__/seletor-de-periodo.test.tsx apps/backoffice/package.json pnpm-lock.yaml
/usr/bin/git commit -m "feat(backoffice): seletor de período com presets, entrada digitada e calendário, na paleta do back-office"
```

(`package.json`/`pnpm-lock.yaml` só se `date-fns` precisou ser adicionado.)

---

### Task 5: Action financeira — plano de contas CRUD, DRE e caixa por intervalo

**Files:**
- Modify: `apps/backoffice/app/actions/empresa/financeiro.ts`
- Modify: `apps/backoffice/__tests__/empresa-financeiro-action.test.ts`

**Interfaces:**
- Consumes: `competenciasNoIntervalo`, `segundasNoIntervalo`, `intervaloValido`, `IntervaloExcedido`, `type Intervalo` (Task 1); `calcularDre(contas, l)`, `type Conta`, `contaValida`, `grupoDoCodigo`, `centroDoGrupo` (Task 3); `database.contaDoPlano` (Task 2).
- Produces:
  - `type ContaView = { conta: string; nome: string; grupo: number; centroDeCusto: string | null; ativa: boolean; ordem: number }`
  - `listarPlanoDeContas(): Promise<Result<ContaView[]>>` (ordenado por `conta`)
  - `criarConta(input: { conta: string; nome: string; centroDeCusto?: string | null }): Promise<Result<ContaView[]>>` — grupo = primeiro dígito; centro = informado (só grupos 3–6, um dos quatro) ou `centroDoGrupo(grupo)`; recusa formato inválido e duplicata (P2002 → "Já existe…" via safeAction); `ordem` = maior ordem do grupo + 1.
  - `atualizarConta(input: { conta: string; nome?: string; ativa?: boolean; centroDeCusto?: string | null }): Promise<Result<ContaView[]>>` — só campos enviados; recusa conta inexistente.
  - `type DreView` ganha `intervalo: Intervalo`; `trimestre` → `total`, `trimestrePercent` → `totalPercent`; `contas[]` ganha `ativa: boolean` e `centroDeCusto`.
  - `lerDre(input: { de: string; ate: string }): Promise<Result<DreView>>` — recusa intervalo inválido ou > 12 meses (mensagem da `IntervaloExcedido`).
  - `salvarLancamento(input: { competencia; conta; valorCentavos; de; ate })` — `competenciaFinal` some; recusa conta inexistente/inativa ("Conta desativada ou fora do plano."); devolve `montarDre({de, ate})`.
  - `type CaixaView` ganha `intervalo: Intervalo`; `lerCaixa(input: { de; ate })`; `salvarSemana(input: { semanaInicio; de; ate; …campos })` devolve `montarCaixa({de, ate})`.
  - Constantes locais (sem export): `ROTA_FINANCEIRO`.

- [ ] **Step 1: Testes** — reescrever `empresa-financeiro-action.test.ts` mantendo o esqueleto de mocks e acrescentando `contaDoPlano: { findMany, findUnique, create, update }`:

```ts
// mocks extra
contaFindMany: vi.fn(), contaFindUnique: vi.fn(), contaCreate: vi.fn(), contaUpdate: vi.fn(),
// no vi.mock("@repo/database"): contaDoPlano: { findMany: mocks.contaFindMany, findUnique: mocks.contaFindUnique, create: mocks.contaCreate, update: mocks.contaUpdate },

const CONTAS = [
  { conta: "1.1", nome: "Assinatura", grupo: 1, centroDeCusto: null, ativa: true, ordem: 0 },
  { conta: "4.1", nome: "Vendas", grupo: 4, centroDeCusto: "comercial", ativa: true, ordem: 15 },
];
// resetar(): mocks.contaFindMany.mockResolvedValue(CONTAS); mocks.contaFindUnique.mockImplementation(async ({ where }) => CONTAS.find((c) => c.conta === where.tenantId_conta.conta) ?? null);

describe("lerDre por intervalo", () => {
  it("uma coluna por mês tocado e a coluna total", async () => {
    const res = await lerDre({ de: "2026-06-15", ate: "2026-09-01" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.competencias).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(res.data.intervalo).toEqual({ de: "2026-06-15", ate: "2026-09-01" });
    const c11 = res.data.contas.find((c) => c.conta === "1.1");
    expect(c11?.valores).toEqual([null, null, 100, 200]);
    expect(res.data.linhas.find((l) => l.id === "c-1.1")?.total).toBeNull();
    expect(mocks.lancFindMany.mock.calls[0][0].where).toMatchObject({ tenantId: "system", competencia: { in: ["2026-06", "2026-07", "2026-08", "2026-09"] } });
    expect(mocks.contaFindMany.mock.calls[0][0].where).toMatchObject({ tenantId: "system" });
  });
  it("recusa intervalo inválido e acima de 12 meses", async () => {
    expect((await lerDre({ de: "2026-09-01", ate: "2026-08-01" })).ok).toBe(false);
    const r = await lerDre({ de: "2025-08-01", ate: "2026-09-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/12 meses/);
  });
});

describe("salvarLancamento", () => {
  it("recusa conta desconhecida e conta inativa", async () => {
    expect((await salvarLancamento({ competencia: "2026-09", conta: "9.9", valorCentavos: 1, de: "2026-07-01", ate: "2026-09-30" })).ok).toBe(false);
    mocks.contaFindUnique.mockResolvedValue({ ...CONTAS[0], ativa: false });
    expect((await salvarLancamento({ competencia: "2026-09", conta: "1.1", valorCentavos: 1, de: "2026-07-01", ate: "2026-09-30" })).ok).toBe(false);
    expect(mocks.lancUpsert).not.toHaveBeenCalled();
  });
  it("grava e devolve a janela pedida", async () => {
    const res = await salvarLancamento({ competencia: "2026-07", conta: "1.1", valorCentavos: 300, de: "2026-07-01", ate: "2026-09-30" });
    expect(res.ok && res.data.competencias).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(mocks.lancUpsert.mock.calls[0][0].where).toEqual({ tenantId_competencia_conta: { tenantId: "system", competencia: "2026-07", conta: "1.1" } });
  });
});

describe("plano de contas", () => {
  it("criarConta deriva grupo e centro do código e recusa formato", async () => {
    mocks.contaCreate.mockResolvedValue({});
    await criarConta({ conta: "4.7", nome: "Eventos" });
    expect(mocks.contaCreate.mock.calls[0][0].data).toMatchObject({ tenantId: "system", conta: "4.7", nome: "Eventos", grupo: 4, centroDeCusto: "comercial", ativa: true, ordem: 16 });
    expect((await criarConta({ conta: "47", nome: "x" })).ok).toBe(false);
    expect((await criarConta({ conta: "1.9", nome: "x", centroDeCusto: "comercial" })).ok).toBe(false); // grupo 1 não tem centro
  });
  it("atualizarConta grava só o enviado e recusa inexistente", async () => {
    mocks.contaUpdate.mockResolvedValue({});
    await atualizarConta({ conta: "4.1", ativa: false });
    expect(mocks.contaUpdate.mock.calls[0][0]).toMatchObject({ where: { tenantId_conta: { tenantId: "system", conta: "4.1" } }, data: { ativa: false } });
    expect((await atualizarConta({ conta: "9.9", nome: "x" })).ok).toBe(false);
  });
  it("MEMBER não cria", async () => {
    mocks.assertCanWrite.mockImplementation(() => { throw new Error("Somente leitura"); });
    expect((await criarConta({ conta: "4.8", nome: "x" })).ok).toBe(false);
  });
});

describe("lerCaixa por intervalo", () => {
  it("devolve as segundas contidas e recusa acima de 26", async () => {
    const res = await lerCaixa({ de: "2026-09-06", ate: "2026-10-04" });
    expect(res.ok && res.data.semanas.map((s) => s.semanaInicio)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(mocks.semanaFindMany.mock.calls[0][0].where.semanaInicio).toEqual({ gte: new Date("2026-08-31T00:00:00Z"), lte: new Date("2026-09-28T00:00:00Z") });
    expect((await lerCaixa({ de: "2026-01-01", ate: "2026-12-31" })).ok).toBe(false);
  });
});

describe("salvarSemana", () => {
  it("devolve a janela pedida", async () => {
    const res = await salvarSemana({ semanaInicio: "2026-09-07", recebiveisCentavos: 500, de: "2026-09-06", ate: "2026-10-04" });
    expect(res.ok && res.data.semanas).toHaveLength(5);
    expect(mocks.semanaUpsert.mock.calls[0][0].update).toEqual({ recebiveisCentavos: 500 });
  });
});
```

Manter os testes existentes que ainda valem (MEMBER não lança; segunda-feira obrigatória) adaptando as chamadas para o novo input. Remover `vi.useFakeTimers` do caixa — a janela vem do input.

- [ ] **Step 2: Rodar — falham.**

- [ ] **Step 3: Implementar** — em `financeiro.ts`:

```ts
import { competenciasNoIntervalo, type Intervalo, IntervaloExcedido, intervaloValido, segundasNoIntervalo } from "@/lib/empresa/periodo";
import { type CentroDeCusto, centroDoGrupo, type Conta, contaValida, grupoDoCodigo } from "@/lib/empresa/plano-de-contas";

const IntervaloSchema = z.object({ de: z.iso.date(), ate: z.iso.date() }).refine(intervaloValido, "Intervalo inválido.");

/** Traduz o teto do lib para o erro que a tela mostra. */
function competencias(i: Intervalo): string[] {
  try { return competenciasNoIntervalo(i); } catch (e) { if (e instanceof IntervaloExcedido) throw new StaffAuthError("FORBIDDEN", e.message); throw e; }
}
function segundas(i: Intervalo): string[] { /* idem com segundasNoIntervalo */ }

const SELECT_CONTA = { conta: true, nome: true, grupo: true, centroDeCusto: true, ativa: true, ordem: true } as const;
export type ContaView = { conta: string; nome: string; grupo: number; centroDeCusto: string | null; ativa: boolean; ordem: number };

async function contasDoPlano(): Promise<ContaView[]> {
  return await database.contaDoPlano.findMany({ where: { tenantId: SYSTEM_TENANT_ID }, orderBy: [{ grupo: "asc" }, { ordem: "asc" }, { conta: "asc" }], select: SELECT_CONTA });
}
function paraConta(c: ContaView): Conta {
  return { conta: c.conta, nome: c.nome, grupo: c.grupo as Conta["grupo"], centroDeCusto: c.centroDeCusto as CentroDeCusto | null, ativa: c.ativa };
}

export async function listarPlanoDeContas(): Promise<Result<ContaView[]>> { /* requirePlatformStaff + contasDoPlano */ }

const CENTROS = ["comercial", "produto-engenharia", "entrega", "ga"] as const;
const CriarContaSchema = z.object({
  conta: z.string().refine(contaValida, "Conta no formato N.N (grupo 1 a 6)."),
  nome: z.string().trim().min(1).max(120),
  centroDeCusto: z.enum(CENTROS).nullable().optional(),
});

export async function criarConta(input: z.infer<typeof CriarContaSchema>): Promise<Result<ContaView[]>> {
  // guard + write; grupo = grupoDoCodigo(conta)!; if (grupo <= 2 && centroDeCusto) → StaffAuthError("FORBIDDEN", "Contas de receita e dedução não têm centro de custo.");
  // centro = centroDeCusto ?? centroDoGrupo(grupo); ordem = (max ordem do grupo via findFirst orderBy ordem desc)?.ordem + 1 ?? 0
  // create; logPlatformAudit(entityType "ContaDoPlano", entityId conta, diff [["conta", "", conta], ["nome", "", nome]]); revalidatePath; return contasDoPlano()
}

const AtualizarContaSchema = z.object({ conta: z.string(), nome: z.string().trim().min(1).max(120).optional(), ativa: z.boolean().optional(), centroDeCusto: z.enum(CENTROS).nullable().optional() });
export async function atualizarConta(input): Promise<Result<ContaView[]>> {
  // guard; findUnique tenantId_conta → StaffAuthError se não existe; data = só definidos; update; audit com diff before/after (nome, ativa, centroDeCusto); revalidate; return contasDoPlano()
}
```

`montarDre(intervalo)`: `competencias = competencias(intervalo)`; `contas = (await contasDoPlano()).map(paraConta)`; lançamentos como hoje; `dres = porMes.map((m) => calcularDre(contas, m))`; `total = somarMeses(dres)`; `linhas` com `total`/`totalPercent`; `contas` da view = as ativas + as inativas com algum lançamento na janela, com `ativa` e `centroDeCusto`; devolve `{ intervalo, competencias, linhas, contas }`. `lerDre(input)` faz `IntervaloSchema.parse`. `salvarLancamento`: schema com `de`/`ate` (`IntervaloSchema` espalhado) — antes do upsert, `const c = await database.contaDoPlano.findUnique({ where: { tenantId_conta: { tenantId: SYSTEM_TENANT_ID, conta } }, select: { ativa: true } }); if (!c?.ativa) throw new StaffAuthError("FORBIDDEN", "Conta desativada ou fora do plano.");`. `montarCaixa(intervalo)`: `janela = segundas(intervalo)`; `gte: dataUtc(janela[0])`, `lte: dataUtc(janela.at(-1))`; devolve `{ intervalo, semanas, … }`. `salvarSemana` idem com `de`/`ate`.

- [ ] **Step 4: Testes passam; `tsc` do back-office ainda pode falhar em `cac.ts` (Task 6) e nas páginas (Task 7) — aceitável nesta task; registrar no report. Biome nos dois arquivos; commit**

```bash
/usr/bin/git add apps/backoffice/app/actions/empresa/financeiro.ts apps/backoffice/__tests__/empresa-financeiro-action.test.ts
/usr/bin/git commit -m "feat(backoffice): plano de contas editável e DRE/caixa por intervalo na action financeira"
```

---

### Task 6: Action do CAC por intervalo

**Files:**
- Modify: `apps/backoffice/app/actions/empresa/cac.ts`
- Modify: `apps/backoffice/__tests__/empresa-cac-action.test.ts`

**Interfaces:**
- Consumes: `competenciasNoIntervalo`, `IntervaloExcedido`, `intervaloValido`, `type Intervalo` (Task 1); `CONTAS_DO_CAC` (Task 3, inalterado).
- Produces: `type CacView` ganha `intervalo: Intervalo`, `competencias: string[]`, `editavel: boolean` e `competenciaEditavel: string` (= última competência; é a que as escritas usam); `competencia` sai. `lerCac(input: { de; ate })`. `salvarParcelas/salvarConversao/salvarAlocacao` continuam por `competencia` mas ganham `de`/`ate` para devolver `montar(intervalo)`.

Regras de agregação (spec §5.2): para cada conta 4.x e para `entregaDiagnosticoCentavos`, soma dos meses, **nula se algum mês estiver nulo**; `clientesGanhos` idem; conversão e alocação do último mês; `sugestaoClientesGanhos` = `proposal.count` com `atualizadoEm` entre o dia 1 do primeiro mês e o dia 1 do mês seguinte ao último.

- [ ] **Step 1: Testes** — adaptar o arquivo: `lerCac({ de, ate })`; `cacFindUnique` vira `cacFindMany` (uma linha por competência, com `competencia` no select); novos casos:

```ts
it("dois meses: soma as parcelas, nulo se um mês falta, conversão do último mês, editavel=false", async () => {
  mocks.lancFindMany.mockResolvedValue([
    { competencia: "2026-08", conta: "4.1", valorCentavos: 100 }, { competencia: "2026-09", conta: "4.1", valorCentavos: 200 },
    { competencia: "2026-09", conta: "4.2", valorCentavos: 50 },
  ]);
  mocks.cacFindMany.mockResolvedValue([
    { competencia: "2026-08", entregaDiagnosticoCentavos: 10, clientesGanhos: 1, convLeadDiscoveryPercent: null, convDiscoveryEvaluationPercent: null, convEvaluationPropostaPercent: null, convPropostaAceitaPercent: 20, alocacoes: [] },
    { competencia: "2026-09", entregaDiagnosticoCentavos: 20, clientesGanhos: 2, convLeadDiscoveryPercent: null, convDiscoveryEvaluationPercent: null, convEvaluationPropostaPercent: null, convPropostaAceitaPercent: 30, alocacoes: [{ produto: "MERIDIAN", pesoPercent: 100 }] },
  ]);
  const res = await lerCac({ de: "2026-08-01", ate: "2026-09-30" });
  expect(res.ok).toBe(true);
  if (!res.ok) return;
  expect(res.data.competencias).toEqual(["2026-08", "2026-09"]);
  expect(res.data.editavel).toBe(false);
  expect(res.data.competenciaEditavel).toBe("2026-09");
  expect(res.data.parcelas["4.1"]).toBe(300);
  expect(res.data.parcelas["4.2"]).toBeNull(); // agosto sem 4.2
  expect(res.data.parcelas.entregaDiagnosticoCentavos).toBe(30);
  expect(res.data.parcelas.clientesGanhos).toBe(3);
  expect(res.data.conversao.convPropostaAceitaPercent).toBe(30);
  expect(res.data.alocacoes).toEqual([{ produto: "MERIDIAN", pesoPercent: 100 }]);
  expect(mocks.proposalCount.mock.calls[0][0].where.atualizadoEm).toEqual({ gte: new Date("2026-08-01T00:00:00Z"), lt: new Date("2026-10-01T00:00:00Z") });
});
it("um mês: editavel=true e comportamento de antes", async () => { /* lerCac({de:"2026-09-01", ate:"2026-09-30"}) → editavel true, competenciaEditavel "2026-09" */ });
it("recusa acima de 12 meses", async () => { expect((await lerCac({ de: "2025-08-01", ate: "2026-09-30" })).ok).toBe(false); });
```

Os testes de `salvarParcelas`/`salvarConversao`/`salvarAlocacao` passam a enviar `de`/`ate` junto com `competencia` (mesma competência, um mês).

- [ ] **Step 2–3: Implementar** — `montar(intervalo)`: `competencias`; `lancamentos` com `competencia: { in }`; `periodos = cacPeriodo.findMany({ where: { tenantId, competencia: { in } }, select: {...anterior, competencia: true}, orderBy: { competencia: "asc" } })`; helper `somaOuNula(valores: (number | null | undefined)[], esperado: number)` — nula se `valores.length < esperado` ou algum nulo; parcelas por conta: para cada conta, valores dos meses (ausente = null); `entrega`/`clientes` idem sobre `periodos` (mês sem CacPeriodo = null); `ultimo = periodos.find(competencia === competencias.at(-1))`; conversão/alocações de `ultimo`; `editavel = competencias.length === 1`; `sugestao` com limites do intervalo de meses. Schemas de escrita: `competencia` + `de`/`ate` (`IntervaloSchema` como na Task 5, duplicado localmente — ou movido para `lib/empresa/periodo.ts` como `IntervaloSchema` exportado; escolher mover e usar nos dois arquivos, e registrar no report).

- [ ] **Step 4: Testes, Biome, commit**

```bash
/usr/bin/git add apps/backoffice/app/actions/empresa/cac.ts apps/backoffice/__tests__/empresa-cac-action.test.ts apps/backoffice/lib/empresa/periodo.ts
/usr/bin/git commit -m "feat(backoffice): CAC agregado por intervalo — parcelas somadas, nulo se faltar mês, edição só com um mês"
```

---

### Task 7: Telas — seletor por aba, aba Plano de contas, CAC por intervalo

**Files:**
- Modify: `apps/backoffice/app/(staff)/empresa/financeiro/page.tsx`, `dre.tsx`, `caixa.tsx`
- Create: `apps/backoffice/app/(staff)/empresa/financeiro/plano.tsx`
- Modify: `apps/backoffice/app/(staff)/empresa/cac/page.tsx`, `painel.tsx`

**Interfaces:**
- Consumes: `SeletorDePeriodo`, `PRESETS_COMPETENCIA`, `PRESETS_CAIXA`, `intervaloPadraoCompetencia`, `intervaloPadraoCaixa`, `lerIntervaloDaUrl` (Tasks 1, 4); actions das Tasks 5 e 6.

- [ ] **Step 1: `financeiro/page.tsx`** — `searchParams: { aba?, de?, ate? }`; `aba ∈ dre|caixa|plano`; `intervalo = lerIntervaloDaUrl({de, ate}, aba === "caixa" ? intervaloPadraoCaixa(hoje) : intervaloPadraoCompetencia(hoje))`; chama `lerDre(intervalo)` / `lerCaixa(intervalo)` / `listarPlanoDeContas()` conforme a aba; três links de aba (os links de DRE/Caixa NÃO carregam `de`/`ate` — cada aba abre no seu padrão); um componente cliente pequeno `SeletorDaAba` (dentro de `page.tsx` não pode — é server; criar `apps/backoffice/app/(staff)/empresa/financeiro/seletor.tsx` `"use client"` que recebe `aba`, `valor`, `presets` e faz `router.push(`/empresa/financeiro?aba=${aba}&de=${i.de}&ate=${i.ate}`)` no `onAplicar`); `key` dos painéis = `${aba}:${intervalo.de}:${intervalo.ate}`. Subtítulo da página menciona o período.
- [ ] **Step 2: `dre.tsx`** — remove o `<input type="month">` e o `router`; `lancar` envia `de`/`ate` de `view.intervalo`; coluna final "Total" (`l.total`/`l.totalPercent`); linhas de conta inativa com opacidade 0.6; a tabela de entrada mostra só `view.contas` (já filtradas pela action) e o input fica `readOnly` quando `!c.ativa`.
- [ ] **Step 3: `caixa.tsx`** — `gravar` envia `de`/`ate` de `view.intervalo`; subtítulo "S1 = <segunda>".
- [ ] **Step 4: `plano.tsx`** — `"use client"`; tabela por grupo (cabeçalho do grupo: "1 · Receita", "2 · Deduções", "3 · Custo de entrega", "4 · Comercial", "5 · Produto e engenharia", "6 · G&A"); colunas código, nome (input inline, `onBlur` → `atualizarConta({conta, nome})` se mudou), centro (select nos grupos 3–6), ativa (botão "Desativar"/"Reativar"); formulário "Nova conta" (código, nome, centro opcional) → `criarConta`; a lista é substituída pela resposta; gated por `podeEscrever`; `Erro` para mensagens.
- [ ] **Step 5: `cac/page.tsx`** — `searchParams: { de?, ate? }`; `intervalo = lerIntervaloDaUrl(…, intervaloPadraoCompetencia(hoje))`; `lerCac(intervalo)`; `key` = `${de}:${ate}`. **`cac/painel.tsx`** — o `<input type="month">` vira `SeletorDePeriodo` com `PRESETS_COMPETENCIA` e `router.push('/empresa/cac?de&ate')`; todos os inputs e botões de escrita ficam desabilitados quando `!view.editavel`, com a nota "Selecione um mês para editar — o período atual agrega N meses"; as escritas usam `view.competenciaEditavel` e enviam `de`/`ate` de `view.intervalo`; o cartão de conversão diz "do mês <competenciaEditavel>" quando `!editavel`.
- [ ] **Step 6: `tsc` limpo em todo o back-office; Biome nos arquivos; commit**

```bash
/usr/bin/git add "apps/backoffice/app/(staff)/empresa/financeiro" "apps/backoffice/app/(staff)/empresa/cac"
/usr/bin/git commit -m "feat(backoffice): seletor de período no CAC e no Financeiro, aba Plano de contas"
```

---

### Task 8: Verificação, seed de produção e registro

- [ ] **Step 1:** `cd apps/backoffice && npx vitest run` (tudo), `npx tsc --noEmit --emitDeclarationOnly false` (backoffice, app, database, provisioning), Biome nos arquivos da branch (`/usr/bin/git diff --name-only <base>..HEAD`).
- [ ] **Step 2:** banco local: `npx prisma migrate status` (up to date), `SELECT count(*) FROM "ContaDoPlano"` = 27.
- [ ] **Step 3 (controller):** navegador: `/empresa/financeiro` abre em "Últimos 3 meses"; preset "Este ano" → 9 colunas + total; aba Plano: criar "4.7 Eventos" → aparece em Comercial no DRE; desativar → some da entrada; `/empresa/cac` com dois meses → inputs bloqueados, nota; um mês → editável.
- [ ] **Step 4:** gerar `seed-contas-prod.sql` (INSERT … ON CONFLICT DO NOTHING das 27 contas, gerado de `plano-de-contas-nebuloz.ts` como o script anterior) e entregar ao usuário.
- [ ] **Step 5:** `.claude/completions/2026-09-06-periodo-e-plano-de-contas.md` com o que entrou, decisões em execução e pendências (SQL em prod só com "vai"; `docs/financeiro/plano-de-contas.md` ganha uma nota de que o plano vive na tabela e o documento é a origem do seed).

```bash
/usr/bin/git add .claude/completions/2026-09-06-periodo-e-plano-de-contas.md docs/financeiro/plano-de-contas.md
/usr/bin/git commit -m "docs: registro do subprojeto A — período por intervalo e plano de contas editável"
```
