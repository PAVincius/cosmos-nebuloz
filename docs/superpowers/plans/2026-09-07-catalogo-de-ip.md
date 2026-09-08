# Catálogo de IP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao `IpAsset` procedência, licença, dono, endereço e serviços que ele encurta, com uma régua de aceitação de seis critérios verificada no servidor, e transformar reuso em fato registrado do qual reusos, horas poupadas e maturidade são derivados.

**Architecture:** O catálogo convive com o editor de markdown que já existe — `conteudo` permanece, `link` entra opcional e seu nulo significa "vive aqui". A régua e a derivação de maturidade moram num módulo puro (`lib/ip/regua.ts`), fora de qualquer `"use server"`, e são chamadas tanto pelo servidor (autoridade) quanto pelo cliente (espelho ao vivo). Reuso vira `IpAssetReuse`, com `@@unique([assetId, engagementId])`.

**Tech Stack:** Next.js 16 App Router · Prisma 7 · zod 4 · Vitest 4 · Biome

**Spec:** [`docs/superpowers/specs/2026-09-07-catalogo-de-ip-design.md`](../specs/2026-09-07-catalogo-de-ip-design.md)

## Global Constraints

- **`"use server"`: todo export vira endpoint POST público**, alcançável sem passar pelo layout `(staff)`. Helper puro nunca é exportado de `app/actions/*.ts` — vai para `lib/`. Toda `export async function` de uma action chama `requirePlatformStaff()`, e toda escrita chama também `assertCanWrite(staff)`.
- **`Date` nunca cruza para o Client Component.** Converter para ISO na fronteira do `listIpAssets`/`getIpAsset`, como já é feito hoje.
- **Português** nos identificadores, comentários e mensagens de erro, seguindo o arquivo vizinho.
- **Complexidade cognitiva máxima 15** (biome `noExcessiveCognitiveComplexity`). Ao estourar, extrair função, não desativar a regra.
- **Tabela-filha sem `tenantId` não recebe RLS** nesta base: `IpAssetVersion` e `StaffAllocation` têm `relrowsecurity = false` e se protegem pelo pai. `IpAssetService` e `IpAssetReuse` seguem isso. Não adicionar `tenantId` a elas — além de contrariar a convenção, é o que faria o guard `apps/app/__tests__/security/tenant-unique-keys.test.ts` disparar sobre `@@unique([assetId, engagementId])`.
- **Comandos:** `../../node_modules/.bin/vitest`, `../../node_modules/.bin/tsc` de dentro de `apps/backoffice`; `./node_modules/.bin/biome check --write <arquivos>` da raiz. **Nunca** `pnpm fix` ou `pnpm check` na raiz — reformata mais de 100 arquivos alheios.
- **Commits sem trailer `Co-Authored-By`.**
- Migration nova em `packages/database/prisma/migrations/20260913000000_catalogo_de_ip/migration.sql`, escrita à mão. Depois dela, `cd packages/database && node_modules/.bin/prisma generate`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/backoffice/lib/ip/regua.ts` | **Criar.** Régua de aceitação, maturidade derivada. Puro, sem imports de servidor |
| `apps/backoffice/__tests__/ip-regua.test.ts` | **Criar.** Testes do módulo acima |
| `packages/database/prisma/schema/platform-ops.prisma` | **Modificar.** Colunas novas em `IpAsset`, modelos `IpAssetService` e `IpAssetReuse` |
| `packages/database/prisma/migrations/20260913000000_catalogo_de_ip/migration.sql` | **Criar.** DDL, renomeação de tipo, sem RLS nas filhas |
| `apps/backoffice/app/actions/ip-library.ts` | **Modificar.** Cadastro com a régua, serviços, reuso, derivados |
| `apps/backoffice/app/(staff)/ip/registrar.tsx` | **Criar.** Modal de cadastro (o pedido) |
| `apps/backoffice/app/(staff)/ip/biblioteca.tsx` | **Modificar.** KPIs, lacunas, registrar reuso na linha |
| `apps/backoffice/app/(staff)/ip/page.tsx` | **Modificar.** Carregar serviços e pessoas |

---

### Task 1: Régua de aceitação e maturidade

Módulo puro. Existe separado porque o servidor é a autoridade sobre a régua e o
cliente precisa espelhá-la ao vivo no painel lateral — duas cópias da mesma
lista divergiriam no primeiro ajuste de texto.

**Files:**
- Create: `apps/backoffice/lib/ip/regua.ts`
- Test: `apps/backoffice/__tests__/ip-regua.test.ts`

**Interfaces:**
- Produz: `TIPOS_DE_ATIVO`, `PROCEDENCIAS`, `LICENCAS`, `type EntradaDeAtivo`, `type Criterio`, `avaliarRegua(e: EntradaDeAtivo): Criterio[]`, `criteriosPendentes(c: Criterio[]): Criterio[]`, `maturidadeDe(reusos: number): "RASCUNHO" | "COMPROVADO"`, `LIMITE_COMPROVADO`
- Consome: nada

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/backoffice/__tests__/ip-regua.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  avaliarRegua,
  criteriosPendentes,
  type EntradaDeAtivo,
  maturidadeDe,
} from "@/lib/ip/regua";

const completa: EntradaDeAtivo = {
  nome: "Playbook de entrevista executiva",
  descricao:
    "Roteiro de 45 min por persona que revela maturidade real, não declarada.",
  link: "notion/entrevista-exec",
  viveAqui: false,
  servicos: ["sv-01"],
  procedencia: "INTERNO",
  origemEngagementId: null,
  reusoConfirmado: false,
  licenca: "NENHUMA",
  licencaRef: "",
};

const idsPendentes = (e: EntradaDeAtivo) =>
  criteriosPendentes(avaliarRegua(e)).map((c) => c.id);

describe("avaliarRegua", () => {
  it("aceita a entrada completa — nenhum critério pendente", () => {
    expect(idsPendentes(completa)).toEqual([]);
  });

  it("devolve sempre os seis critérios, na ordem, atendidos ou não", () => {
    const ids = avaliarRegua(completa).map((c) => c.id);
    expect(ids).toEqual([
      "IP-R1",
      "IP-R2",
      "IP-R3",
      "IP-R4",
      "IP-R5",
      "IP-R6",
    ]);
  });

  it("IP-R1: nome com menos de 3 caracteres", () => {
    expect(idsPendentes({ ...completa, nome: "AB" })).toContain("IP-R1");
  });

  it("IP-R2: descrição com menos de 40 caracteres", () => {
    expect(idsPendentes({ ...completa, descricao: "curta demais" })).toContain(
      "IP-R2"
    );
  });

  it("IP-R3: sem link e sem viver aqui", () => {
    expect(idsPendentes({ ...completa, link: "" })).toContain("IP-R3");
  });

  it("IP-R3: sem link mas vivendo aqui é aceito — o editor é o endereço", () => {
    expect(
      idsPendentes({ ...completa, link: "", viveAqui: true })
    ).not.toContain("IP-R3");
  });

  it("IP-R4: nenhum serviço vinculado", () => {
    expect(idsPendentes({ ...completa, servicos: [] })).toContain("IP-R4");
  });

  it("IP-R5: nascido em engajamento sem cláusula de reuso confirmada", () => {
    expect(
      idsPendentes({
        ...completa,
        procedencia: "ENGAJAMENTO",
        origemEngagementId: "eng-1",
        reusoConfirmado: false,
      })
    ).toContain("IP-R5");
  });

  it("IP-R5: nascido em engajamento sem dizer qual também é pendente", () => {
    expect(
      idsPendentes({
        ...completa,
        procedencia: "ENGAJAMENTO",
        origemEngagementId: null,
        reusoConfirmado: true,
      })
    ).toContain("IP-R5");
  });

  it("IP-R5: engajamento com cláusula e com engajamento nomeado passa", () => {
    expect(
      idsPendentes({
        ...completa,
        procedencia: "ENGAJAMENTO",
        origemEngagementId: "eng-1",
        reusoConfirmado: true,
      })
    ).not.toContain("IP-R5");
  });

  it("IP-R6: licença não resolvida bloqueia", () => {
    expect(
      idsPendentes({ ...completa, licenca: "NAO_RESOLVIDA" })
    ).toContain("IP-R6");
  });

  it("IP-R6: copyleft sem referência bloqueia", () => {
    expect(
      idsPendentes({ ...completa, licenca: "COPYLEFT", licencaRef: "" })
    ).toContain("IP-R6");
  });

  it("IP-R6: comercial sem referência bloqueia", () => {
    expect(
      idsPendentes({ ...completa, licenca: "COMERCIAL", licencaRef: "" })
    ).toContain("IP-R6");
  });

  it("IP-R6: copyleft com componente e versão passa", () => {
    expect(
      idsPendentes({
        ...completa,
        licenca: "COPYLEFT",
        licencaRef: "bpmn-js AGPL-3.0",
      })
    ).not.toContain("IP-R6");
  });

  it("IP-R6: permissiva não pede referência", () => {
    expect(
      idsPendentes({ ...completa, licenca: "PERMISSIVA", licencaRef: "" })
    ).not.toContain("IP-R6");
  });
});

describe("maturidadeDe", () => {
  it("é rascunho até o primeiro reuso", () => {
    expect(maturidadeDe(0)).toBe("RASCUNHO");
    expect(maturidadeDe(1)).toBe("RASCUNHO");
  });

  it("vira comprovado no segundo reuso", () => {
    expect(maturidadeDe(2)).toBe("COMPROVADO");
    expect(maturidadeDe(9)).toBe("COMPROVADO");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd apps/backoffice && ../../node_modules/.bin/vitest run __tests__/ip-regua.test.ts
```

Esperado: falha em `Failed to resolve import "@/lib/ip/regua"`.

- [ ] **Step 3: Escrever o módulo**

Criar `apps/backoffice/lib/ip/regua.ts`:

```ts
/**
 * Régua de aceitação do catálogo de IP.
 *
 * Puro de propósito: o servidor é a autoridade sobre a régua, e o painel
 * lateral do formulário precisa espelhá-la enquanto a pessoa digita. Duas
 * cópias da mesma lista divergiriam no primeiro ajuste de texto, e a divergente
 * seria justamente a que a pessoa lê antes de clicar.
 */

export const TIPOS_DE_ATIVO = [
  "ACELERADOR",
  "PLAYBOOK",
  "TEMPLATE",
  "EVAL_HARNESS",
  "MODELO_BPMN",
  "DOCUMENTO",
] as const;
export type TipoDeAtivo = (typeof TIPOS_DE_ATIVO)[number];

export const PROCEDENCIAS = [
  "INTERNO",
  "ENGAJAMENTO",
  "LAB",
  "TERCEIRO",
] as const;
export type Procedencia = (typeof PROCEDENCIAS)[number];

export const LICENCAS = [
  "NENHUMA",
  "PERMISSIVA",
  "COPYLEFT",
  "COMERCIAL",
  "NAO_RESOLVIDA",
] as const;
export type Licenca = (typeof LICENCAS)[number];

/** Licenças que só valem com o componente e a versão escritos. */
const EXIGEM_REFERENCIA: readonly Licenca[] = ["COPYLEFT", "COMERCIAL"];

const MIN_NOME = 3;
const MIN_DESCRICAO = 40;
const MIN_LINK = 4;
const MIN_REFERENCIA = 3;

/** A partir de quantos reusos o ativo deixa de ser rascunho. */
export const LIMITE_COMPROVADO = 2;

export type EntradaDeAtivo = {
  nome: string;
  descricao: string;
  link: string;
  /** O ativo mora no editor do próprio catálogo, e não num endereço externo. */
  viveAqui: boolean;
  servicos: string[];
  procedencia: Procedencia;
  origemEngagementId: string | null;
  reusoConfirmado: boolean;
  licenca: Licenca;
  licencaRef: string;
};

export type Criterio = {
  id: string;
  texto: string;
  ok: boolean;
};

/**
 * Os seis critérios, sempre na mesma ordem e sempre todos — a lista é a mesma
 * atendida ou não, porque ela também é o que a pessoa lê para saber o que falta.
 */
export function avaliarRegua(e: EntradaDeAtivo): Criterio[] {
  const licencaResolvida =
    e.licenca !== "NAO_RESOLVIDA" &&
    (!EXIGEM_REFERENCIA.includes(e.licenca) ||
      e.licencaRef.trim().length >= MIN_REFERENCIA);

  // Cláusula de reuso é de um contrato específico: confirmar sem dizer qual
  // não confirma nada.
  const procedenciaResolvida =
    e.procedencia !== "ENGAJAMENTO" ||
    (e.reusoConfirmado && Boolean(e.origemEngagementId));

  return [
    {
      id: "IP-R1",
      texto: "Nome que outra pessoa acha na busca",
      ok: e.nome.trim().length >= MIN_NOME,
    },
    {
      id: "IP-R2",
      texto: "Problema que ele resolve, em uma frase",
      ok: e.descricao.trim().length >= MIN_DESCRICAO,
    },
    {
      id: "IP-R3",
      texto: "Endereço onde o ativo vive de verdade",
      ok: e.viveAqui || e.link.trim().length >= MIN_LINK,
    },
    {
      id: "IP-R4",
      texto: "Pelo menos um serviço que ele encurta",
      ok: e.servicos.length > 0,
    },
    {
      id: "IP-R5",
      texto: "Direito de reuso confirmado na procedência",
      ok: procedenciaResolvida,
    },
    {
      id: "IP-R6",
      texto: "Licença de terceiro resolvida e referenciada",
      ok: licencaResolvida,
    },
  ];
}

export function criteriosPendentes(criterios: Criterio[]): Criterio[] {
  return criterios.filter((c) => !c.ok);
}

/**
 * Maturidade não é escolhida em lugar nenhum: é função da contagem de reuso.
 * O ativo vira comprovado quando o SEGUNDO reuso é registrado — o primeiro
 * ainda é o uso que o criou.
 */
export function maturidadeDe(reusos: number): "RASCUNHO" | "COMPROVADO" {
  return reusos >= LIMITE_COMPROVADO ? "COMPROVADO" : "RASCUNHO";
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
cd apps/backoffice && ../../node_modules/.bin/vitest run __tests__/ip-regua.test.ts
```

Esperado: 17 testes passando.

- [ ] **Step 5: Lint e commit**

```bash
./node_modules/.bin/biome check --write apps/backoffice/lib/ip/regua.ts apps/backoffice/__tests__/ip-regua.test.ts
```

```bash
git add apps/backoffice/lib/ip/regua.ts apps/backoffice/__tests__/ip-regua.test.ts && git commit -m "feat(backoffice): régua de aceitação do catálogo de IP e maturidade derivada"
```

---

### Task 2: Schema e migration

**Files:**
- Modify: `packages/database/prisma/schema/platform-ops.prisma` (bloco `model IpAsset`, a partir da linha 502)
- Create: `packages/database/prisma/migrations/20260913000000_catalogo_de_ip/migration.sql`

**Interfaces:**
- Consome: nada
- Produz: colunas `link`, `donoPersonId`, `procedencia`, `reusoConfirmado`, `licenca`, `licencaRef` em `IpAsset`; modelos `IpAssetService` e `IpAssetReuse`; relações `assetsQueMantem` em `StaffPerson`, `ipServices` em `Service`, `ipReuses` em `Engagement`

- [ ] **Step 1: Editar o schema**

Em `packages/database/prisma/schema/platform-ops.prisma`, dentro de `model IpAsset`, depois do bloco de `conteudo` e antes de `origemEngagementId`, inserir:

```prisma
  /// Endereço onde o ativo vive de verdade ("repo/…", "notion/…", "drive/…").
  /// NULO É SIGNIFICATIVO: quer dizer que ele vive aqui, no editor deste
  /// catálogo. Não existe coluna "vive aqui" porque o nulo já é essa
  /// informação, e duas fontes para o mesmo fato divergem.
  link String?

  /// Quem MANTÉM o ativo, que não é quem o criou. `criadoPorId` continua
  /// existindo e responde a outra pergunta. SetNull: pessoa sai da casa, o
  /// ativo fica sem dono até alguém assumir — some o dono, não o ativo.
  donoPersonId String?

  /// INTERNO | ENGAJAMENTO | LAB | TERCEIRO — de onde ele veio, que é o que
  /// decide se existe direito de reuso.
  procedencia String @default("INTERNO")

  /// Cláusula de reuso conferida no contrato. Só significa algo quando
  /// `procedencia` é ENGAJAMENTO: sem ela, o artefato é IP do cliente e
  /// registrá-lo aqui cria passivo, não ativo.
  reusoConfirmado Boolean @default(false)

  /// NENHUMA | PERMISSIVA | COPYLEFT | COMERCIAL | NAO_RESOLVIDA
  licenca String @default("NENHUMA")

  /// Número da licença ou componente e versão. Obrigatório em COPYLEFT e
  /// COMERCIAL: um copyleft sem dizer qual componente não permite revisar
  /// nada antes de vender.
  licencaRef String?
```

Ainda em `model IpAsset`, no bloco de relações (junto de `versions`), acrescentar:

```prisma
  dono     StaffPerson?     @relation("IpAssetDono", fields: [donoPersonId], references: [id], onDelete: SetNull)
  servicos IpAssetService[]
  reusos   IpAssetReuse[]
```

E no bloco de índices, junto dos `@@index` existentes:

```prisma
  @@index([donoPersonId])
```

Depois do `model IpAssetVersion`, acrescentar os dois modelos novos:

```prisma
/// Que serviços este ativo encurta. Sem vínculo, o ativo não aparece na hora
/// de montar proposta — que é onde ele paga.
///
/// Sem `tenantId` e sem RLS, como `IpAssetVersion`: alcança-se só pelo pai, e o
/// pai é isolado.
model IpAssetService {
  assetId   String
  serviceId String

  asset   IpAsset @relation(fields: [assetId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@id([assetId, serviceId])
  @@index([serviceId])
}

/// Um reuso do ativo num engajamento. É a fonte de reusos, horas poupadas e
/// maturidade — nenhum dos três é digitado em lugar nenhum.
///
/// `@@unique([assetId, engagementId])` porque "foi reusado no EN-041" é um
/// fato, não um contador: registrar duas vezes contaria o mesmo reuso duas
/// vezes, e o número da tela deixaria de ser verificável.
model IpAssetReuse {
  id           String @id @default(cuid())
  assetId      String
  engagementId String

  /// Horas que este reuso poupou em relação a fazer do zero. Fica no evento,
  /// não no ativo: uma média guardada no ativo e multiplicada pela contagem
  /// seria uma segunda fonte para o mesmo número, e um reuso difícil não
  /// poderia contar diferente de um fácil.
  horasPoupadas Int     @default(0)
  nota          String? @db.Text

  registradoPorId   String
  registradoPorNome String?
  criadoEm          DateTime @default(now())

  asset      IpAsset    @relation(fields: [assetId], references: [id], onDelete: Cascade)
  engagement Engagement @relation(fields: [engagementId], references: [id], onDelete: Cascade)

  @@unique([assetId, engagementId])
  @@index([assetId])
  @@index([engagementId])
}
```

Em `model StaffPerson`, no bloco de relações (junto de `alocacoes`):

```prisma
  assetsQueMantem IpAsset[] @relation("IpAssetDono")
```

Em `model Service`, no bloco de relações:

```prisma
  ipServices IpAssetService[]
```

Em `model Engagement`, no bloco de relações:

```prisma
  ipReuses IpAssetReuse[]
```

- [ ] **Step 2: Escrever a migration**

Criar `packages/database/prisma/migrations/20260913000000_catalogo_de_ip/migration.sql`:

```sql
-- Catálogo de IP: procedência, licença, dono, endereço, serviços e reuso.

ALTER TABLE "IpAsset"
  ADD COLUMN "link" TEXT,
  ADD COLUMN "donoPersonId" TEXT,
  ADD COLUMN "procedencia" TEXT NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN "reusoConfirmado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "licenca" TEXT NOT NULL DEFAULT 'NENHUMA',
  ADD COLUMN "licencaRef" TEXT;

-- COMPONENTE e ACELERADOR são o mesmo conceito com dois nomes, e dois nomes
-- para uma coisa divergem. DOCUMENTO fica: já tem linhas e é o caso genérico.
UPDATE "IpAsset" SET "tipo" = 'ACELERADOR' WHERE "tipo" = 'COMPONENTE';

DO $$
DECLARE restantes BIGINT;
BEGIN
  SELECT count(*) INTO restantes FROM "IpAsset" WHERE "tipo" = 'COMPONENTE';
  IF restantes <> 0 THEN
    RAISE EXCEPTION 'renomeacao de tipo incompleta: % linhas ainda em COMPONENTE', restantes;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "IpAsset_donoPersonId_idx" ON "IpAsset"("donoPersonId");

ALTER TABLE "IpAsset" ADD CONSTRAINT "IpAsset_donoPersonId_fkey"
  FOREIGN KEY ("donoPersonId") REFERENCES "StaffPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IpAssetService" (
  "assetId"   TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "IpAssetService_pkey" PRIMARY KEY ("assetId", "serviceId")
);
CREATE INDEX IF NOT EXISTS "IpAssetService_serviceId_idx" ON "IpAssetService"("serviceId");

ALTER TABLE "IpAssetService" ADD CONSTRAINT "IpAssetService_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "IpAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IpAssetService" ADD CONSTRAINT "IpAssetService_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "IpAssetReuse" (
  "id"                TEXT NOT NULL,
  "assetId"           TEXT NOT NULL,
  "engagementId"      TEXT NOT NULL,
  "horasPoupadas"     INTEGER NOT NULL DEFAULT 0,
  "nota"              TEXT,
  "registradoPorId"   TEXT NOT NULL,
  "registradoPorNome" TEXT,
  "criadoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IpAssetReuse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IpAssetReuse_assetId_engagementId_key"
  ON "IpAssetReuse"("assetId", "engagementId");
CREATE INDEX IF NOT EXISTS "IpAssetReuse_assetId_idx" ON "IpAssetReuse"("assetId");
CREATE INDEX IF NOT EXISTS "IpAssetReuse_engagementId_idx" ON "IpAssetReuse"("engagementId");

ALTER TABLE "IpAssetReuse" ADD CONSTRAINT "IpAssetReuse_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "IpAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IpAssetReuse" ADD CONSTRAINT "IpAssetReuse_engagementId_fkey"
  FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sem RLS nas duas tabelas novas, de propósito: elas não têm `tenantId` e só
-- se alcança por `IpAsset`, que tem RLS forçada. É a mesma forma de
-- `IpAssetVersion` e `StaffAllocation` nesta base.
```

- [ ] **Step 3: Aplicar no banco local e conferir**

```bash
cd packages/database && node -e 'const fs=require("fs"),{Client}=require("pg");const url=fs.readFileSync("../../apps/app/.env.local","utf8").match(/^DATABASE_URL="?([^"\n]+)/m)[1];const sql=fs.readFileSync("prisma/migrations/20260913000000_catalogo_de_ip/migration.sql","utf8");(async()=>{const c=new Client({connectionString:url});await c.connect();await c.query(sql);const r=await c.query("SELECT table_name, count(*) AS colunas FROM information_schema.columns WHERE table_name IN (\x27IpAssetService\x27,\x27IpAssetReuse\x27) GROUP BY table_name ORDER BY table_name");console.table(r.rows);await c.end()})().catch(e=>{console.error("FALHOU:",e.message);process.exit(1)})'
```

Esperado: `IpAssetReuse` com 8 colunas, `IpAssetService` com 2. Sem erro.

- [ ] **Step 4: Regenerar o client**

```bash
cd packages/database && node_modules/.bin/prisma generate
```

Esperado: `Generated Prisma Client`.

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/schema/platform-ops.prisma packages/database/prisma/migrations/20260913000000_catalogo_de_ip && git commit -m "feat(database): catálogo de IP ganha procedência, licença, dono, serviços e reuso"
```

---

### Task 3: Cadastro com a régua no servidor

A lista lateral do formulário é espelho; a autoridade é aqui. Um `POST` direto
na action, sem passar pela tela, precisa bater na mesma régua.

**Files:**
- Modify: `apps/backoffice/app/actions/ip-library.ts`

**Interfaces:**
- Consome: `avaliarRegua`, `criteriosPendentes`, `maturidadeDe`, `TIPOS_DE_ATIVO`, `PROCEDENCIAS`, `LICENCAS` de `@/lib/ip/regua`
- Produz: `IpAssetRow` com `link`, `dono`, `procedencia`, `licenca`, `servicos`, `reusos`, `horasPoupadas`, `maturidade`; `createIpAssetAction` com a assinatura estendida

- [ ] **Step 1: Trocar a constante local de tipos pela do módulo**

Em `apps/backoffice/app/actions/ip-library.ts`, remover:

```ts
const TIPOS = ["TEMPLATE", "PLAYBOOK", "COMPONENTE", "DOCUMENTO"] as const;
export type TipoDeAtivo = (typeof TIPOS)[number];
```

e acrescentar aos imports:

```ts
import {
  avaliarRegua,
  criteriosPendentes,
  LICENCAS,
  maturidadeDe,
  PROCEDENCIAS,
  TIPOS_DE_ATIVO,
} from "@/lib/ip/regua";
```

Conferir com `grep -rn "TipoDeAtivo" apps/backoffice` se alguém importava o
tipo daqui; se sim, o import passa a ser de `@/lib/ip/regua`.

- [ ] **Step 2: Estender `IpAssetRow` e `listIpAssets`**

Substituir o `type IpAssetRow` por:

```ts
export type IpAssetRow = {
  id: string;
  nome: string;
  slug: string;
  tipo: string;
  descricao: string | null;
  /** Nulo quer dizer que o ativo vive aqui, no editor. */
  link: string | null;
  dono: string | null;
  procedencia: string;
  licenca: string;
  servicos: { id: string; codigo: string; nome: string }[];
  reusos: number;
  horasPoupadas: number;
  maturidade: "RASCUNHO" | "COMPROVADO";
  versoes: number;
  origem: string | null;
  atualizadoEm: string;
};
```

No `select` de `listIpAssets`, acrescentar aos campos existentes:

```ts
        link: true,
        procedencia: true,
        licenca: true,
        dono: { select: { nome: true } },
        servicos: {
          select: { service: { select: { id: true, codigo: true, nome: true } } },
        },
        reusos: { select: { horasPoupadas: true } },
```

e no `map` final, acrescentar ao objeto devolvido:

```ts
      link: a.link,
      dono: a.dono ? a.dono.nome : null,
      procedencia: a.procedencia,
      licenca: a.licenca,
      servicos: a.servicos.map((s) => s.service),
      reusos: a.reusos.length,
      // Soma dos eventos, nunca uma média digitada multiplicada por uma
      // contagem — duas fontes para o mesmo número divergem.
      horasPoupadas: a.reusos.reduce((s, r) => s + r.horasPoupadas, 0),
      maturidade: maturidadeDe(a.reusos.length),
```

Fazer o mesmo acréscimo no `include`/retorno de `getIpAsset`, para que
`IpAssetDetail` (que estende `IpAssetRow`) continue satisfazendo o tipo.

- [ ] **Step 3: Estender o schema de criação e aplicar a régua**

Substituir `CriarSchema` por:

```ts
const CriarSchema = z.object({
  nome: z.string().min(3).max(140),
  tipo: z.enum(TIPOS_DE_ATIVO).optional(),
  descricao: z.string().min(40).max(500),
  conteudo: z.string().min(1),
  link: z.string().max(300).optional(),
  viveAqui: z.boolean().optional(),
  donoPersonId: z.string().optional(),
  servicoIds: z.array(z.string().min(1)).min(1).max(20),
  procedencia: z.enum(PROCEDENCIAS).optional(),
  origemEngagementId: z.string().optional(),
  reusoConfirmado: z.boolean().optional(),
  licenca: z.enum(LICENCAS).optional(),
  licencaRef: z.string().max(200).optional(),
});
```

Dentro de `createIpAssetAction`, logo depois de `const dados = CriarSchema.parse(input);`, inserir:

```ts
    // A régua roda aqui porque a lista lateral do formulário é espelho, não
    // autoridade: um POST direto nesta action não passa por tela nenhuma.
    const pendentes = criteriosPendentes(
      avaliarRegua({
        nome: dados.nome,
        descricao: dados.descricao,
        link: dados.link ?? "",
        viveAqui: dados.viveAqui ?? false,
        servicos: dados.servicoIds,
        procedencia: dados.procedencia ?? "INTERNO",
        origemEngagementId: dados.origemEngagementId ?? null,
        reusoConfirmado: dados.reusoConfirmado ?? false,
        licenca: dados.licenca ?? "NENHUMA",
        licencaRef: dados.licencaRef ?? "",
      })
    );
    if (pendentes.length > 0) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `Faltam ${pendentes.length} critério(s) da régua: ${pendentes.map((c) => c.texto).join("; ")}.`
      );
    }
```

- [ ] **Step 4: Gravar os campos novos e os serviços**

Dentro da transação, no `tx.ipAsset.create`, acrescentar ao `data`:

```ts
          tipo: dados.tipo ?? "DOCUMENTO",
          link: dados.viveAqui ? null : (dados.link?.trim() ?? null),
          donoPersonId: dados.donoPersonId ?? null,
          procedencia: dados.procedencia ?? "INTERNO",
          reusoConfirmado: dados.reusoConfirmado ?? false,
          licenca: dados.licenca ?? "NENHUMA",
          licencaRef: dados.licencaRef?.trim() || null,
```

(a linha `tipo:` já existe — substituir, não duplicar; `descricao: dados.descricao ?? null` vira `descricao: dados.descricao`.)

Depois do `tx.ipAssetVersion.create`, ainda na mesma transação:

```ts
      // Vínculo de serviço na mesma transação que o ativo: um ativo sem
      // serviço nenhum é exatamente o que a IP-R4 recusa, e um estado que a
      // régua proíbe não pode existir nem por um instante entre dois writes.
      await tx.ipAssetService.createMany({
        data: dados.servicoIds.map((serviceId) => ({
          assetId: a.id,
          serviceId,
        })),
      });
```

- [ ] **Step 5: Verificar tipo e lint**

```bash
cd apps/backoffice && ../../node_modules/.bin/tsc --noEmit
```

Esperado: sem saída.

```bash
./node_modules/.bin/biome check --write apps/backoffice/app/actions/ip-library.ts
```

Se `createIpAssetAction` estourar complexidade 15, extrair a montagem da
`EntradaDeAtivo` para uma função não exportada `entradaDaRegua(dados)` no
próprio arquivo.

- [ ] **Step 6: Commit**

```bash
git add apps/backoffice/app/actions/ip-library.ts && git commit -m "feat(backoffice): cadastro de ativo passa pela régua no servidor e vincula serviços"
```

---

### Task 4: Registrar reuso

**Files:**
- Modify: `apps/backoffice/app/actions/ip-library.ts`

**Interfaces:**
- Consome: `IpAssetRow` da Task 3
- Produz: `registrarReusoAction(input): Promise<Result<{ id: string; reusos: number; maturidade: "RASCUNHO" | "COMPROVADO" }>>`

- [ ] **Step 1: Escrever a action**

No fim de `apps/backoffice/app/actions/ip-library.ts`:

```ts
const ReusoSchema = z.object({
  assetId: z.string().min(1),
  engagementId: z.string().min(1),
  horasPoupadas: z.number().int().min(0).max(400),
  nota: z.string().max(300).optional(),
});

/**
 * Registra que o ativo foi reusado num engajamento.
 *
 * É o único caminho por onde reusos, horas poupadas e maturidade mudam — os
 * três são derivados desta tabela e não existem como campo em lugar nenhum.
 */
export async function registrarReusoAction(
  input: z.input<typeof ReusoSchema>
): Promise<
  Result<{ id: string; reusos: number; maturidade: "RASCUNHO" | "COMPROVADO" }>
> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = ReusoSchema.parse(input);

    const ativo = await database.ipAsset.findFirst({
      where: { id: dados.assetId, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, nome: true },
    });
    if (!ativo) {
      throw new StaffAuthError("FORBIDDEN", "Ativo não encontrado.");
    }

    const engajamento = await database.engagement.findFirst({
      where: { id: dados.engagementId, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, codigo: true, nome: true },
    });
    if (!engajamento) {
      throw new StaffAuthError("FORBIDDEN", "Engajamento não encontrado.");
    }

    // "Foi reusado no EN-041" é um fato, não um contador. Recusar aqui, com a
    // frase inteira, evita que o `@@unique` apareça como erro do Prisma.
    const jaRegistrado = await database.ipAssetReuse.findUnique({
      where: {
        assetId_engagementId: {
          assetId: ativo.id,
          engagementId: engajamento.id,
        },
      },
      select: { id: true },
    });
    if (jaRegistrado) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${ativo.nome} já consta como reusado em ${engajamento.codigo}. Registrar de novo contaria o mesmo reuso duas vezes.`
      );
    }

    const criado = await database.ipAssetReuse.create({
      data: {
        assetId: ativo.id,
        engagementId: engajamento.id,
        horasPoupadas: dados.horasPoupadas,
        nota: dados.nota?.trim() || null,
        registradoPorId: staff.userId,
        registradoPorNome: staff.name,
      },
      select: { id: true },
    });

    const reusos = await database.ipAssetReuse.count({
      where: { assetId: ativo.id },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "ip_asset_reuse",
      entityId: criado.id,
      target: `${ativo.nome} → ${engajamento.codigo} (${dados.horasPoupadas}h)`,
      note: dados.nota,
    });

    revalidatePath("/ip");
    return { id: criado.id, reusos, maturidade: maturidadeDe(reusos) };
  });
}
```

- [ ] **Step 2: Verificar tipo**

```bash
cd apps/backoffice && ../../node_modules/.bin/tsc --noEmit
```

Esperado: sem saída.

- [ ] **Step 3: Lint e commit**

```bash
./node_modules/.bin/biome check --write apps/backoffice/app/actions/ip-library.ts
```

```bash
git add apps/backoffice/app/actions/ip-library.ts && git commit -m "feat(backoffice): registrar reuso de ativo, com o par ativo/engajamento como fato único"
```

---

### Task 5: Modal de cadastro

O pedido do usuário. Duas colunas: campos à esquerda, régua ao vivo e prévia do
catálogo à direita, rodapé com o placar de critérios e o botão desabilitado até
a régua fechar.

**Files:**
- Create: `apps/backoffice/app/(staff)/ip/registrar.tsx`
- Modify: `apps/backoffice/app/(staff)/ip/page.tsx`

**Interfaces:**
- Consome: `avaliarRegua`, `criteriosPendentes`, `TIPOS_DE_ATIVO`, `PROCEDENCIAS`, `LICENCAS`, `type EntradaDeAtivo` de `@/lib/ip/regua`; `createIpAssetAction`, `type IpAssetRow` de `@/app/actions/ip-library`; `ServiceRow` de `@/app/actions/services`; `PessoaCapacidade` de `@/app/actions/capacity`; `EngagementRow` de `@/app/actions/engagements`
- Produz: `<RegistrarAtivo onCriado={(a: IpAssetRow) => void} onErro={(m: string) => void} servicos={ServiceRow[]} pessoas={PessoaCapacidade[]} engajamentos={EngagementRow[]} />`

- [ ] **Step 1: Escrever o componente**

Criar `apps/backoffice/app/(staff)/ip/registrar.tsx` como Client Component
(`"use client"` na primeira linha). Estrutura obrigatória:

- Estado único `form` com os campos de `EntradaDeAtivo` mais `tipo`, `donoPersonId` e `conteudo`.
- `const criterios = avaliarRegua(entrada)` derivado do estado a cada render — **não** duplicar as condições em `if` locais; a régua é o módulo.
- `const pendentes = criteriosPendentes(criterios)`; botão `disabled={pendentes.length > 0}`.
- Rótulos textuais, vindos do design: tipos `Acelerador · Playbook · Template · Eval harness · Modelo BPMN · Documento`; procedências `Investimento interno · Engajamento de cliente · LAB · Base de terceiro`; licenças `Nenhuma · Permissiva · Copyleft · Licenciada · Não resolvida`.
- Descrição das procedências, exibida sob os chips conforme a seleção:
  - `INTERNO`: "Construído em tempo não faturado. Reuso livre."
  - `ENGAJAMENTO`: "Nasceu em entrega paga. Exige cláusula de reuso no contrato."
  - `LAB`: "Saída de pesquisa interna. Verificar licença do dataset de origem."
  - `TERCEIRO`: "Adaptação de material de fora. A licença manda."
- Descrição das licenças, mesma mecânica:
  - `NENHUMA`: "Nada de terceiro dentro do ativo."
  - `PERMISSIVA`: "MIT, Apache-2.0, BSD. Reuso comercial liberado com atribuição."
  - `COPYLEFT`: "GPL, AGPL. Contamina o entregável do cliente — revisar antes de vender."
  - `COMERCIAL`: "Metodologia ou software pago. Exige número de licença."
  - `NAO_RESOLVIDA`: "Bloqueia o registro. Sem licença conhecida não existe direito de reuso."
- Campo `licencaRef` só aparece quando `licenca` é `COPYLEFT` ou `COMERCIAL`, com placeholder `"bpmn-js AGPL-3.0"` ou `"Prosci ADKAR — LIC-2026-014"` conforme o caso.
- Bloco de procedência: quando `procedencia === "ENGAJAMENTO"`, mostrar o select de engajamento e o checkbox "Confirmo cláusula de reuso no contrato de {cliente}", com a nota "Sem essa cláusula o artefato é IP do cliente. Registrar assim cria passivo, não ativo (IP-R5)."
- Alternância "onde vive": quando `viveAqui`, o campo de link some e nada é enviado em `link`.
- Contador `{n}/40` sob a descrição, verde a partir de 40.
- Painel lateral: a lista `criterios` com `☑`/`☐` (usar `c.ok`), e a prévia com nome, badge de tipo, badge "Rascunho", dono, procedência e licença.
- Rodapé: `pendentes.length === 0 ? "Régua de aceitação atendida" : \`${pendentes.length} de 6 critérios pendentes\``.

Reutilizar `Campo`, `INPUT`, `BotaoPrimario` de `@/components/campo` e `Badge`,
`SectionCard` de `@repo/design-system/cosmos/kit`, como fazem as telas vizinhas.
Não construir shell de modal: não existe um no back-office nem no kit, e o
formulário de capacidade estabeleceu o padrão de bloco expansível na tela.

`conteudo` enviado é `` `# ${nome}\n\n` ``, como o formulário atual já faz.

- [ ] **Step 2: Carregar os dados novos na página**

Em `apps/backoffice/app/(staff)/ip/page.tsx`, acrescentar aos imports e ao
`Promise.all`:

```ts
import { listCapacity } from "@/app/actions/capacity";
import { listServices } from "@/app/actions/services";
```

```ts
  const [staff, ativos, engajamentos, servicos, pessoas] = await Promise.all([
    requirePlatformStaff(),
    listIpAssets(),
    listEngagements(),
    listServices(),
    listCapacity(),
  ]);

  const tudoCarregou =
    ativos.ok && engajamentos.ok && servicos.ok && pessoas.ok;
```

e passar `pessoas={pessoas.data}` e `servicos={servicos.data}` ao `<Biblioteca>`.
Acrescentar as duas mensagens ao bloco de erro, no mesmo formato das existentes.

`listCapacity` é reusada em vez de uma action nova: a equipe da casa tem ordem
de dez linhas, e uma segunda listagem de pessoas seria uma segunda fonte para a
mesma lista.

- [ ] **Step 3: Ligar o componente na Biblioteca**

Em `biblioteca.tsx`, substituir o bloco `{criando ? (...) : null}` do card
"Acervo" por `<RegistrarAtivo … />`, mantendo o botão "Novo"/"Cancelar" que já
existe. `onCriado` faz `setLista((a) => [novo, ...a])` e `setCriando(false)`.

- [ ] **Step 4: Verificar tipo e lint**

```bash
cd apps/backoffice && ../../node_modules/.bin/tsc --noEmit
```

```bash
./node_modules/.bin/biome check --write "apps/backoffice/app/(staff)/ip/registrar.tsx" "apps/backoffice/app/(staff)/ip/biblioteca.tsx" "apps/backoffice/app/(staff)/ip/page.tsx"
```

Se `RegistrarAtivo` estourar complexidade 15, extrair os blocos de procedência e
de licença em componentes próprios no mesmo arquivo.

- [ ] **Step 5: Commit**

```bash
git add "apps/backoffice/app/(staff)/ip" && git commit -m "feat(backoffice): modal de registro de ativo com régua ao vivo e procedência"
```

---

### Task 6: KPIs, lacunas de IP e registrar reuso na linha

**Files:**
- Modify: `apps/backoffice/app/(staff)/ip/biblioteca.tsx`

**Interfaces:**
- Consome: `IpAssetRow` estendida (Task 3), `registrarReusoAction` (Task 4), `ServiceRow`
- Produz: nada para tarefas seguintes

- [ ] **Step 1: Três KPIs no topo da tela**

- **Ativos no catálogo** — `lista.length`, com nota `${comprovados} comprovado(s) em campo`, onde `comprovados = lista.filter((a) => a.maturidade === "COMPROVADO").length`
- **Reusos acumulados** — `lista.reduce((s, a) => s + a.reusos, 0)`, nota "em engajamentos entregues"
- **Horas poupadas** — `lista.reduce((s, a) => s + a.horasPoupadas, 0)`, nota "versus fazer do zero"

Sem KPI de margem em reais: não existe custo/hora blended no back-office, e o
spec o deixou fora por isso.

- [ ] **Step 2: Painel "lacunas de IP"**

Serviços ativos sem nenhum ativo vinculado:

```tsx
const comAtivo = new Set(lista.flatMap((a) => a.servicos.map((s) => s.id)));
const lacunas = servicos.filter((s) => s.ativo && !comAtivo.has(s.id));
```

Renderizar cada lacuna com código e nome do serviço, e a nota de rodapé do
painel: "Serviço vendido várias vezes sem IP registrado é margem deixada na
mesa — e sinal de que alguém está reescrevendo o mesmo material."

- [ ] **Step 3: Registrar reuso na linha do ativo**

Botão "Registrar reuso" em cada linha (só quando `podeEscrever`), abrindo um
bloco com select de engajamento, campo numérico de horas poupadas e nota
opcional. Ao confirmar, chamar `registrarReusoAction` e atualizar a linha na
lista com `reusos` e `maturidade` do retorno, somando as horas informadas ao
`horasPoupadas` local.

O bloco precisa ser `key`-ado pelo id do ativo, como o `ConfirmarAcao` do mapa
de processos: sem isso, abrir em A e trocar para B registraria em B o que foi
digitado para A.

- [ ] **Step 4: Mostrar o que o catálogo agora sabe na linha**

Na linha de cada ativo, além do que já aparece: badge de maturidade
(`Rascunho` neutro / `Comprovado` verde), badge de procedência quando não for
`INTERNO`, badge de licença quando não for `NENHUMA`, o dono, e os códigos dos
serviços vinculados. Quando `link` não for nulo, mostrá-lo em fonte mono; quando
for nulo, a nota "vive aqui".

- [ ] **Step 5: Verificar tudo**

```bash
cd apps/backoffice && ../../node_modules/.bin/tsc --noEmit && ../../node_modules/.bin/vitest run
```

Esperado: sem saída do `tsc`; suíte inteira verde.

```bash
cd apps/app && ../../node_modules/.bin/vitest run __tests__/security/tenant-unique-keys.test.ts
```

Esperado: passa. `IpAssetReuse` não tem `tenantId`, então a regra não se aplica
a ela — se este teste falhar, a solução **não** é acrescentar a chave à
allowlist: é conferir se alguém adicionou `tenantId` à tabela contrariando a
constraint global.

```bash
./node_modules/.bin/biome check --write "apps/backoffice/app/(staff)/ip/biblioteca.tsx"
```

- [ ] **Step 6: Commit**

```bash
git add "apps/backoffice/app/(staff)/ip/biblioteca.tsx" && git commit -m "feat(backoffice): catálogo de IP mostra reuso medido, lacunas por serviço e procedência na linha"
```

---

## Verificação final

Antes de encerrar o plano:

```bash
cd apps/backoffice && ../../node_modules/.bin/tsc --noEmit && ../../node_modules/.bin/vitest run
```

```bash
cd apps/app && ../../node_modules/.bin/vitest run
```

```bash
cd packages/database && ../../node_modules/.bin/vitest run
```

Criar `.claude/completions/2026-09-07-catalogo-de-ip.md` com seção **ponytail**
explícita: o que foi cortado, o que foi mantido apesar de custar, e que teto
ficou marcado no código.

Verificação em produção fica com o usuário, depois do push: `/ip`, registrar um
ativo com procedência de engajamento sem marcar a cláusula (deve recusar),
registrar o mesmo reuso duas vezes (deve recusar com a frase inteira), e conferir
que o segundo reuso promove o ativo a comprovado.
