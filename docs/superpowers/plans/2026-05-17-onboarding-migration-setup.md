# Onboarding – migration_setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** Plan `2026-05-17-onboarding-company-setup.md` must be completed first — `OnboardingProgress`, `MigrationConnection` DB models and `actions/onboarding/index.ts` must exist.

**Goal:** Migration wizard at `/onboarding/migration` that imports projects, epics, features, stories, and teams from CSV, Jira Cloud, Azure DevOps, or Trello into COSMOS entities, with discovery, dry-run preview, and import report.

**Architecture:** 6-step wizard (same `OnboardingWizardShell` from Plan 1). Each integration source has 4 server-side API routes (`/api/migration/[source]/connect|discover|dry-run|import`). Credentials stored in `MigrationConnection.config` JSON (never exposed client-side after save). Import creates real COSMOS entities via existing actions.

**Tech Stack:** Next.js API Routes for external API proxying, `csv-parse` for CSV, native `fetch` with source-specific auth headers (Jira Basic, Azure Basic PAT, Trello query params), `@repo/database` Prisma for entity creation, `useTransition` + polling for import progress.

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `apps/app/app/actions/onboarding/migration.ts` | `saveMigrationConnection`, `approveMigrationMapping`, `getMigrationConnection` |
| `apps/app/app/api/migration/[source]/connect/route.ts` | Test connection + create `MigrationConnection` |
| `apps/app/app/api/migration/[source]/discover/route.ts` | Fetch projects/boards/issues from source |
| `apps/app/app/api/migration/[source]/dry-run/route.ts` | Simulate import, return counts + conflicts |
| `apps/app/app/api/migration/[source]/import/route.ts` | Execute real import, return report |
| `apps/app/app/(authenticated)/onboarding/migration/page.tsx` | Server component: load progress + connection |
| `apps/app/app/(authenticated)/onboarding/migration/complete/page.tsx` | Import report screen |
| `apps/app/app/(authenticated)/onboarding/migration/components/migration-wizard-client.tsx` | 6-step orchestrator |
| `apps/app/app/(authenticated)/onboarding/migration/components/steps/step-source-select.tsx` | Source + scope choice |
| `apps/app/app/(authenticated)/onboarding/migration/components/steps/step-connect-integration.tsx` | Credential form per source |
| `apps/app/app/(authenticated)/onboarding/migration/components/steps/step-discovery.tsx` | Mapping table |
| `apps/app/app/(authenticated)/onboarding/migration/components/steps/step-dry-run.tsx` | Impact preview |
| `apps/app/app/(authenticated)/onboarding/migration/components/steps/step-import.tsx` | Progress + polling |
| `apps/app/app/(authenticated)/onboarding/migration/components/steps/step-post-migration.tsx` | Report + gap analysis |
| `apps/app/lib/migration/csv-parser.ts` | CSV → MigrationItem[] parser |
| `apps/app/lib/migration/jira-client.ts` | Jira REST API helpers |
| `apps/app/lib/migration/azure-client.ts` | Azure DevOps REST API helpers |
| `apps/app/lib/migration/trello-client.ts` | Trello REST API helpers |
| `apps/app/lib/migration/types.ts` | Shared MigrationItem, MappingRule, DryRunResult types |

---

## Task 1: Shared migration types + CSV parser

**Files:**
- Create: `apps/app/lib/migration/types.ts`
- Create: `apps/app/lib/migration/csv-parser.ts`

- [ ] **Step 1: Install `csv-parse`**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
pnpm add csv-parse
```

Expected: added to `package.json`.

- [ ] **Step 2: Write tests for CSV parser**

Create `apps/app/lib/migration/__tests__/csv-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseMigrationCSV } from "../csv-parser";

describe("parseMigrationCSV", () => {
  it("parses epic rows", () => {
    const csv = `type,title,description,status,team,sprint,storyPoints,parentTitle
epic,My Epic,desc,BACKLOG,,,0,`;
    const items = parseMigrationCSV(csv);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "epic", title: "My Epic", status: "BACKLOG" });
  });

  it("parses story rows with parent", () => {
    const csv = `type,title,description,status,team,sprint,storyPoints,parentTitle
story,Story A,,IN_PROGRESS,Team Alpha,Sprint 1,5,My Epic`;
    const items = parseMigrationCSV(csv);
    expect(items[0]).toMatchObject({ type: "story", title: "Story A", parentTitle: "My Epic", storyPoints: 5 });
  });

  it("ignores rows with empty title", () => {
    const csv = `type,title,description,status,team,sprint,storyPoints,parentTitle
story,,,,,,0,`;
    expect(parseMigrationCSV(csv)).toHaveLength(0);
  });

  it("throws on missing required columns", () => {
    const csv = `name,description\nFoo,Bar`;
    expect(() => parseMigrationCSV(csv)).toThrow("Missing required columns");
  });
});
```

- [ ] **Step 3: Run test — verify FAIL**

```bash
pnpm test lib/migration/__tests__/csv-parser.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Create `types.ts`**

```typescript
// apps/app/lib/migration/types.ts

export type MigrationItemType = "epic" | "feature" | "story" | "team" | "sprint";

export interface MigrationItem {
  type: MigrationItemType;
  title: string;
  description?: string;
  status?: string;
  team?: string;
  sprint?: string;
  storyPoints?: number;
  parentTitle?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface MappingRule {
  sourceKey: string;  // e.g. project name or board id
  targetType: "portfolio" | "value_stream" | "art" | "team" | "pi";
  targetName: string; // name of the existing COSMOS entity to link to
}

export interface DryRunResult {
  counts: {
    epics: number;
    features: number;
    stories: number;
    teams: number;
    sprints: number;
  };
  conflicts: Array<{
    item: string;
    reason: string;
  }>;
  totalItems: number;
}

export interface ImportReport {
  created: { epics: number; features: number; stories: number; teams: number };
  updated: number;
  errors: Array<{ item: string; error: string }>;
  totalProcessed: number;
}
```

- [ ] **Step 5: Create `csv-parser.ts`**

```typescript
// apps/app/lib/migration/csv-parser.ts
import { parse } from "csv-parse/sync";
import type { MigrationItem, MigrationItemType } from "./types";

const REQUIRED_COLUMNS = ["type", "title"] as const;

export function parseMigrationCSV(csvContent: string): MigrationItem[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  if (records.length === 0) return [];

  const cols = Object.keys(records[0]);
  for (const req of REQUIRED_COLUMNS) {
    if (!cols.includes(req)) {
      throw new Error(`Missing required columns: ${req}. Found: ${cols.join(", ")}`);
    }
  }

  return records
    .filter((r) => r.title?.trim())
    .map((r) => ({
      type: (r.type?.toLowerCase() ?? "story") as MigrationItemType,
      title: r.title.trim(),
      description: r.description?.trim() || undefined,
      status: r.status?.trim() || undefined,
      team: r.team?.trim() || undefined,
      sprint: r.sprint?.trim() || undefined,
      storyPoints: r.storyPoints ? parseInt(r.storyPoints, 10) || 0 : undefined,
      parentTitle: r.parentTitle?.trim() || undefined,
    }));
}
```

- [ ] **Step 6: Run test — verify PASS**

```bash
pnpm test lib/migration/__tests__/csv-parser.test.ts
```

Expected: all 4 pass.

- [ ] **Step 7: Commit**

```bash
git add apps/app/lib/migration/
git commit -m "feat(migration): shared types + CSV parser"
```

---

## Task 2: Source API client helpers (Jira, Azure, Trello)

**Files:**
- Create: `apps/app/lib/migration/jira-client.ts`
- Create: `apps/app/lib/migration/azure-client.ts`
- Create: `apps/app/lib/migration/trello-client.ts`

- [ ] **Step 1: Create `jira-client.ts`**

```typescript
// apps/app/lib/migration/jira-client.ts
import type { MigrationItem } from "./types";

interface JiraConfig { baseUrl: string; email: string; apiToken: string; projectKeys?: string[] }

function authHeader(email: string, apiToken: string) {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

export async function testJiraConnection(config: JiraConfig): Promise<void> {
  const res = await fetch(`${config.baseUrl}/rest/api/2/myself`, {
    headers: { Authorization: authHeader(config.email, config.apiToken), "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Jira connection failed: ${res.status} ${res.statusText}`);
}

export async function discoverJiraProjects(config: JiraConfig): Promise<{ key: string; name: string }[]> {
  const res = await fetch(`${config.baseUrl}/rest/api/2/project`, {
    headers: { Authorization: authHeader(config.email, config.apiToken) },
  });
  if (!res.ok) throw new Error(`Failed to fetch Jira projects: ${res.statusText}`);
  const data = (await res.json()) as { key: string; name: string }[];
  const keys = config.projectKeys;
  return keys?.length ? data.filter((p) => keys.includes(p.key)) : data;
}

export async function fetchJiraItems(config: JiraConfig, projectKey: string): Promise<MigrationItem[]> {
  const jql = `project = ${projectKey} ORDER BY created DESC`;
  const res = await fetch(`${config.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=500&fields=summary,description,issuetype,status,assignee,story_points,parent,sprint`, {
    headers: { Authorization: authHeader(config.email, config.apiToken) },
  });
  if (!res.ok) throw new Error(`Failed to fetch Jira issues: ${res.statusText}`);
  const data = (await res.json()) as { issues: { id: string; fields: Record<string, unknown> }[] };

  return data.issues.map((issue) => {
    const fields = issue.fields;
    const issueType = ((fields.issuetype as { name?: string })?.name ?? "story").toLowerCase();
    const typeMap: Record<string, "epic" | "feature" | "story"> = { epic: "epic", story: "story", "sub-task": "story" };

    return {
      type: typeMap[issueType] ?? "story",
      title: (fields.summary as string) ?? "",
      description: (fields.description as string) ?? undefined,
      status: (fields.status as { name?: string })?.name ?? undefined,
      storyPoints: (fields.story_points as number) ?? (fields.customfield_10016 as number) ?? undefined,
      parentTitle: (fields.parent as { fields?: { summary?: string } })?.fields?.summary ?? undefined,
      externalId: issue.id,
    };
  });
}
```

- [ ] **Step 2: Create `azure-client.ts`**

```typescript
// apps/app/lib/migration/azure-client.ts
import type { MigrationItem } from "./types";

interface AzureConfig { organization: string; project: string; pat: string }

function authHeader(pat: string) {
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

const BASE = (org: string) => `https://dev.azure.com/${org}`;

export async function testAzureConnection(config: AzureConfig): Promise<void> {
  const res = await fetch(`${BASE(config.organization)}/_apis/projects?api-version=7.0`, {
    headers: { Authorization: authHeader(config.pat) },
  });
  if (!res.ok) throw new Error(`Azure DevOps connection failed: ${res.status} ${res.statusText}`);
}

export async function discoverAzureProjects(config: AzureConfig): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${BASE(config.organization)}/_apis/projects?api-version=7.0`, {
    headers: { Authorization: authHeader(config.pat) },
  });
  if (!res.ok) throw new Error(`Failed to fetch Azure projects: ${res.statusText}`);
  const data = (await res.json()) as { value: { id: string; name: string }[] };
  return data.value;
}

export async function fetchAzureWorkItems(config: AzureConfig): Promise<MigrationItem[]> {
  const wiqlRes = await fetch(
    `${BASE(config.organization)}/${config.project}/_apis/wit/wiql?api-version=7.0`,
    {
      method: "POST",
      headers: { Authorization: authHeader(config.pat), "Content-Type": "application/json" },
      body: JSON.stringify({ query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project ORDER BY [System.CreatedDate] DESC" }),
    }
  );
  if (!wiqlRes.ok) throw new Error("Failed to query Azure work items");
  const wiql = (await wiqlRes.json()) as { workItems: { id: number }[] };

  const ids = wiql.workItems.slice(0, 200).map((w) => w.id);
  if (!ids.length) return [];

  const detailRes = await fetch(
    `${BASE(config.organization)}/_apis/wit/workitems?ids=${ids.join(",")}&fields=System.Title,System.Description,System.WorkItemType,System.State,System.AreaPath,Microsoft.VSTS.Common.StoryPoints&api-version=7.0`,
    { headers: { Authorization: authHeader(config.pat) } }
  );
  if (!detailRes.ok) throw new Error("Failed to fetch Azure work item details");
  const detail = (await detailRes.json()) as { value: { id: number; fields: Record<string, unknown> }[] };

  const typeMap: Record<string, "epic" | "feature" | "story"> = { "Epic": "epic", "Feature": "feature", "User Story": "story", "Task": "story", "Bug": "story" };

  return detail.value.map((wi) => ({
    type: typeMap[(wi.fields["System.WorkItemType"] as string) ?? ""] ?? "story",
    title: (wi.fields["System.Title"] as string) ?? "",
    description: (wi.fields["System.Description"] as string) ?? undefined,
    status: (wi.fields["System.State"] as string) ?? undefined,
    storyPoints: (wi.fields["Microsoft.VSTS.Common.StoryPoints"] as number) ?? undefined,
    externalId: String(wi.id),
  }));
}
```

- [ ] **Step 3: Create `trello-client.ts`**

```typescript
// apps/app/lib/migration/trello-client.ts
import type { MigrationItem } from "./types";

interface TrelloConfig { apiKey: string; apiToken: string; boardIds?: string[] }

const BASE = "https://api.trello.com/1";
function auth(cfg: TrelloConfig) { return `key=${cfg.apiKey}&token=${cfg.apiToken}`; }

export async function testTrelloConnection(config: TrelloConfig): Promise<void> {
  const res = await fetch(`${BASE}/members/me?${auth(config)}`);
  if (!res.ok) throw new Error(`Trello connection failed: ${res.status} ${res.statusText}`);
}

export async function discoverTrelloBoards(config: TrelloConfig): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${BASE}/members/me/boards?${auth(config)}&fields=id,name`);
  if (!res.ok) throw new Error("Failed to fetch Trello boards");
  const boards = (await res.json()) as { id: string; name: string }[];
  return config.boardIds?.length ? boards.filter((b) => config.boardIds!.includes(b.id)) : boards;
}

export async function fetchTrelloCards(config: TrelloConfig, boardId: string): Promise<MigrationItem[]> {
  const res = await fetch(`${BASE}/boards/${boardId}/cards?${auth(config)}&fields=id,name,desc,idList,labels`);
  if (!res.ok) throw new Error("Failed to fetch Trello cards");
  const cards = (await res.json()) as { id: string; name: string; desc: string; labels: { name: string }[] }[];

  return cards.map((card) => ({
    type: "story" as const,
    title: card.name,
    description: card.desc || undefined,
    externalId: card.id,
  }));
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/app/lib/migration/
git commit -m "feat(migration): Jira, Azure DevOps, Trello API client helpers"
```

---

## Task 3: Migration server actions

**Files:**
- Create: `apps/app/app/actions/onboarding/migration.ts`

- [ ] **Step 1: Create `migration.ts`**

```typescript
// apps/app/app/actions/onboarding/migration.ts
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SourceSchema = z.enum(["csv", "jira", "azure", "trello"]);

export async function saveMigrationConnection(raw: {
  source: string;
  config: Record<string, unknown>;
}) {
  const ctx = await requireTenantSession(await headers());
  const source = SourceSchema.parse(raw.source);

  const existing = await database.migrationConnection.findFirst({
    where: { tenantId: ctx.tenantId, source },
  });

  if (existing) {
    return database.migrationConnection.update({
      where: { id: existing.id },
      data: { config: raw.config, status: "pending", errorMessage: null },
    });
  }

  return database.migrationConnection.create({
    data: { tenantId: ctx.tenantId, source, config: raw.config, status: "pending" },
  });
}

export async function getMigrationConnection(source: string) {
  const ctx = await requireTenantSession(await headers());
  return database.migrationConnection.findFirst({
    where: { tenantId: ctx.tenantId, source },
  });
}

export async function approveMigrationMapping(connectionId: string, mappingData: unknown) {
  const ctx = await requireTenantSession(await headers());
  const conn = await database.migrationConnection.findFirst({
    where: { id: connectionId, tenantId: ctx.tenantId },
  });
  if (!conn) throw new Error("Migration connection not found.");
  return database.migrationConnection.update({
    where: { id: connectionId },
    data: { mappingData: mappingData as object },
  });
}

export async function saveMigrationImportReport(connectionId: string, report: unknown) {
  const ctx = await requireTenantSession(await headers());
  return database.migrationConnection.update({
    where: { id: connectionId, tenantId: ctx.tenantId } as { id: string },
    data: { importReport: report as object, status: "connected" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/actions/onboarding/migration.ts
git commit -m "feat(migration): saveMigrationConnection, approveMigrationMapping, getMigrationConnection actions"
```

---

## Task 4: API Routes – connect, discover, dry-run, import

**Files:**
- Create: `apps/app/app/api/migration/[source]/connect/route.ts`
- Create: `apps/app/app/api/migration/[source]/discover/route.ts`
- Create: `apps/app/app/api/migration/[source]/dry-run/route.ts`
- Create: `apps/app/app/api/migration/[source]/import/route.ts`

- [ ] **Step 1: Create `connect/route.ts`**

```typescript
// apps/app/app/api/migration/[source]/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { testJiraConnection } from "@/lib/migration/jira-client";
import { testAzureConnection } from "@/lib/migration/azure-client";
import { testTrelloConnection } from "@/lib/migration/trello-client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { source } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    // Test connection
    if (source === "jira") {
      await testJiraConnection(body as { baseUrl: string; email: string; apiToken: string });
    } else if (source === "azure") {
      await testAzureConnection(body as { organization: string; project: string; pat: string });
    } else if (source === "trello") {
      await testTrelloConnection(body as { apiKey: string; apiToken: string });
    } else if (source === "csv") {
      // CSV: just validate that a file path or content was provided
      if (!body.content) throw new Error("CSV content is required.");
    } else {
      return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }

    // Save connection
    const existing = await database.migrationConnection.findFirst({ where: { tenantId: ctx.tenantId, source } });
    const conn = existing
      ? await database.migrationConnection.update({ where: { id: existing.id }, data: { config: body, status: "connected", errorMessage: null } })
      : await database.migrationConnection.create({ data: { tenantId: ctx.tenantId, source, config: body, status: "connected" } });

    return NextResponse.json({ connectionId: conn.id, status: "connected" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create `discover/route.ts`**

```typescript
// apps/app/app/api/migration/[source]/discover/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { discoverJiraProjects, fetchJiraItems } from "@/lib/migration/jira-client";
import { discoverAzureProjects } from "@/lib/migration/azure-client";
import { discoverTrelloBoards } from "@/lib/migration/trello-client";
import { parseMigrationCSV } from "@/lib/migration/csv-parser";
import type { MigrationItem } from "@/lib/migration/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { source } = await params;
    const { connectionId } = (await req.json()) as { connectionId: string };

    const conn = await database.migrationConnection.findFirst({ where: { id: connectionId, tenantId: ctx.tenantId } });
    if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const config = conn.config as Record<string, unknown>;
    let projects: { id?: string; key?: string; name: string }[] = [];
    let items: MigrationItem[] = [];

    if (source === "jira") {
      projects = await discoverJiraProjects(config as { baseUrl: string; email: string; apiToken: string; projectKeys?: string[] });
      for (const p of projects.slice(0, 5)) {
        const projectItems = await fetchJiraItems(config as { baseUrl: string; email: string; apiToken: string }, p.key ?? p.name);
        items.push(...projectItems);
      }
    } else if (source === "azure") {
      projects = await discoverAzureProjects(config as { organization: string; project: string; pat: string });
    } else if (source === "trello") {
      projects = await discoverTrelloBoards(config as { apiKey: string; apiToken: string; boardIds?: string[] });
    } else if (source === "csv") {
      items = parseMigrationCSV((config.content as string) ?? "");
      projects = [{ name: "CSV Import", id: "csv" }];
    }

    // Cache discovery data
    await database.migrationConnection.update({ where: { id: connectionId }, data: { discoveryData: { projects, itemSample: items.slice(0, 20) } } });

    return NextResponse.json({ projects, itemCount: items.length, itemSample: items.slice(0, 20) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Discovery failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `dry-run/route.ts`**

```typescript
// apps/app/app/api/migration/[source]/dry-run/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { parseMigrationCSV } from "@/lib/migration/csv-parser";
import { fetchJiraItems } from "@/lib/migration/jira-client";
import { fetchAzureWorkItems } from "@/lib/migration/azure-client";
import { fetchTrelloCards } from "@/lib/migration/trello-client";
import type { DryRunResult, MappingRule } from "@/lib/migration/types";

export async function POST(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { source } = await params;
    const { connectionId, mappingData } = (await req.json()) as { connectionId: string; mappingData: MappingRule[] };

    const conn = await database.migrationConnection.findFirst({ where: { id: connectionId, tenantId: ctx.tenantId } });
    if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const config = conn.config as Record<string, unknown>;
    const allItems = [];

    if (source === "csv") {
      allItems.push(...parseMigrationCSV((config.content as string) ?? ""));
    } else if (source === "jira") {
      const discovery = (conn.discoveryData as { projects: { key?: string; name: string }[] } | null);
      for (const p of (discovery?.projects ?? []).slice(0, 5)) {
        allItems.push(...await fetchJiraItems(config as { baseUrl: string; email: string; apiToken: string }, p.key ?? p.name));
      }
    } else if (source === "azure") {
      allItems.push(...await fetchAzureWorkItems(config as { organization: string; project: string; pat: string }));
    } else if (source === "trello") {
      const discovery = (conn.discoveryData as { projects: { id: string; name: string }[] } | null);
      for (const board of (discovery?.projects ?? []).slice(0, 3)) {
        allItems.push(...await fetchTrelloCards(config as { apiKey: string; apiToken: string }, board.id ?? ""));
      }
    }

    const counts: DryRunResult["counts"] = { epics: 0, features: 0, stories: 0, teams: 0, sprints: 0 };
    const conflicts: DryRunResult["conflicts"] = [];

    for (const item of allItems) {
      if (item.type === "epic") counts.epics++;
      else if (item.type === "feature") counts.features++;
      else counts.stories++;
      if (!item.title?.trim()) conflicts.push({ item: `[${item.type}] (sem título)`, reason: "Título vazio" });
    }

    const result: DryRunResult = { counts, conflicts: conflicts.slice(0, 50), totalItems: allItems.length };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Dry-run failed" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `import/route.ts`**

```typescript
// apps/app/app/api/migration/[source]/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@repo/auth/server";
import { headers } from "next/headers";
import { database } from "@repo/database";
import { parseMigrationCSV } from "@/lib/migration/csv-parser";
import { fetchJiraItems } from "@/lib/migration/jira-client";
import { fetchAzureWorkItems } from "@/lib/migration/azure-client";
import { fetchTrelloCards } from "@/lib/migration/trello-client";
import type { ImportReport, MappingRule, MigrationItem } from "@/lib/migration/types";

async function createMigrationEntities(ctx: { tenantId: string }, items: MigrationItem[], mappingData: MappingRule[]): Promise<ImportReport> {
  const report: ImportReport = { created: { epics: 0, features: 0, stories: 0, teams: 0 }, updated: 0, errors: [], totalProcessed: 0 };

  // Build parent title → id map
  const epicTitleToId = new Map<string, string>();

  for (const item of items) {
    report.totalProcessed++;
    try {
      if (item.type === "epic" || item.type === "feature") {
        const mapping = mappingData.find((m) => m.targetType === "art") ?? mappingData[0];
        const art = mapping ? await database.aRT.findFirst({ where: { tenantId: ctx.tenantId, name: mapping.targetName } }) : null;

        const epic = await database.epic.create({
          data: {
            tenantId: ctx.tenantId,
            title: item.title,
            description: item.description ?? null,
            statusId: item.status ?? "BACKLOG",
            artId: art?.id ?? null,
          },
        });
        epicTitleToId.set(item.title, epic.id);
        report.created.epics++;
      } else if (item.type === "story") {
        const parentEpicId = item.parentTitle ? epicTitleToId.get(item.parentTitle) : null;
        await database.story.create({
          data: {
            tenantId: ctx.tenantId,
            title: item.title,
            description: item.description ?? null,
            status: (item.status as "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE") ?? "BACKLOG",
            storyPoints: item.storyPoints ?? 0,
            epicId: parentEpicId ?? null,
          },
        });
        report.created.stories++;
      }
    } catch (err) {
      report.errors.push({ item: item.title, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return report;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ source: string }> }) {
  try {
    const ctx = await requireTenantSession(await headers());
    const { source } = await params;
    const { connectionId, mappingData } = (await req.json()) as { connectionId: string; mappingData: MappingRule[] };

    const conn = await database.migrationConnection.findFirst({ where: { id: connectionId, tenantId: ctx.tenantId } });
    if (!conn) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const config = conn.config as Record<string, unknown>;
    const allItems: MigrationItem[] = [];

    if (source === "csv") {
      allItems.push(...parseMigrationCSV((config.content as string) ?? ""));
    } else if (source === "jira") {
      const disc = (conn.discoveryData as { projects: { key?: string; name: string }[] } | null);
      for (const p of (disc?.projects ?? []).slice(0, 5)) {
        allItems.push(...await fetchJiraItems(config as { baseUrl: string; email: string; apiToken: string }, p.key ?? p.name));
      }
    } else if (source === "azure") {
      allItems.push(...await fetchAzureWorkItems(config as { organization: string; project: string; pat: string }));
    } else if (source === "trello") {
      const disc = (conn.discoveryData as { projects: { id: string; name: string }[] } | null);
      for (const board of (disc?.projects ?? []).slice(0, 3)) {
        allItems.push(...await fetchTrelloCards(config as { apiKey: string; apiToken: string }, board.id ?? ""));
      }
    }

    const report = await createMigrationEntities({ tenantId: ctx.tenantId }, allItems, mappingData);

    // Persist report
    await database.migrationConnection.update({ where: { id: connectionId }, data: { importReport: report as object } });

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/api/migration/
git commit -m "feat(migration): API routes connect/discover/dry-run/import for all 4 sources"
```

---

## Task 5: Migration wizard steps (UI)

**Files:**
- Create: `step-source-select.tsx`, `step-connect-integration.tsx`, `step-discovery.tsx`, `step-dry-run.tsx`, `step-import.tsx`, `step-post-migration.tsx`

- [ ] **Step 1: Create `step-source-select.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/components/steps/step-source-select.tsx
"use client";

import { useState } from "react";
import { Label } from "@repo/design-system/components/ui/label";
import { DatabaseIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";
import { cn } from "@repo/design-system/lib/utils";

export type MigrationSource = "csv" | "jira" | "azure" | "trello";

const SOURCES: { id: MigrationSource; label: string; description: string }[] = [
  { id: "csv", label: "CSV genérico", description: "Arquivo CSV/XLSX de qualquer ferramenta" },
  { id: "jira", label: "Jira Cloud", description: "Projetos, épicos, stories, sprints" },
  { id: "azure", label: "Azure DevOps", description: "Work items, iterations, teams" },
  { id: "trello", label: "Trello", description: "Boards, lists, cards" },
];

export interface SourceSelectFormData { source: MigrationSource }

interface Props {
  defaultValues?: Partial<SourceSelectFormData>;
  onChange: (data: SourceSelectFormData) => void;
}

export function StepSourceSelect({ defaultValues, onChange }: Props) {
  const [selected, setSelected] = useState<MigrationSource>(defaultValues?.source ?? "csv");

  function select(src: MigrationSource) {
    setSelected(src);
    onChange({ source: src });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<DatabaseIcon className="h-5 w-5" />}
        title="Selecione a origem"
        description="De onde você quer migrar seus dados?"
      />
      <div className="grid grid-cols-2 gap-3">
        {SOURCES.map((src) => (
          <button
            key={src.id}
            type="button"
            onClick={() => select(src.id)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
              selected === src.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/50"
            )}
          >
            <span className="font-medium text-sm">{src.label}</span>
            <span className="text-xs text-muted-foreground">{src.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `step-connect-integration.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/components/steps/step-connect-integration.tsx
"use client";

import { useState, useTransition } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckCircle2Icon, XCircleIcon, LinkIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";
import type { MigrationSource } from "./step-source-select";

export interface ConnectFormData { source: MigrationSource; config: Record<string, unknown>; connectionId?: string }

interface Props {
  source: MigrationSource;
  defaultValues?: Partial<ConnectFormData>;
  onConnected: (data: ConnectFormData) => void;
}

export function StepConnectIntegration({ source, defaultValues, onConnected }: Props) {
  const [config, setConfig] = useState<Record<string, unknown>>(defaultValues?.config ?? {});
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(key: string, value: unknown) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function handleTest() {
    setStatus("testing");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/migration/${source}/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        const data = (await res.json()) as { connectionId?: string; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? "Connection failed");
        setStatus("ok");
        onConnected({ source, config, connectionId: data.connectionId });
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Connection failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<LinkIcon className="h-5 w-5" />}
        title="Conectar integração"
        description={`Configure as credenciais para ${source === "csv" ? "upload do CSV" : source.toUpperCase()}.`}
      />
      <div className="flex flex-col gap-4">
        {source === "jira" && (
          <>
            <Field label="URL base do Jira (ex: https://yourorg.atlassian.net)" id="baseUrl">
              <Input value={(config.baseUrl as string) ?? ""} onChange={(e) => update("baseUrl", e.target.value)} placeholder="https://yourorg.atlassian.net" />
            </Field>
            <Field label="Email" id="email">
              <Input type="email" value={(config.email as string) ?? ""} onChange={(e) => update("email", e.target.value)} placeholder="you@company.com" />
            </Field>
            <Field label="API Token" id="apiToken">
              <Input type="password" value={(config.apiToken as string) ?? ""} onChange={(e) => update("apiToken", e.target.value)} placeholder="Jira API token" />
            </Field>
          </>
        )}
        {source === "azure" && (
          <>
            <Field label="Organização Azure DevOps" id="org">
              <Input value={(config.organization as string) ?? ""} onChange={(e) => update("organization", e.target.value)} placeholder="minha-org" />
            </Field>
            <Field label="Projeto" id="project">
              <Input value={(config.project as string) ?? ""} onChange={(e) => update("project", e.target.value)} placeholder="Meu Projeto" />
            </Field>
            <Field label="Personal Access Token (PAT)" id="pat">
              <Input type="password" value={(config.pat as string) ?? ""} onChange={(e) => update("pat", e.target.value)} placeholder="PAT" />
            </Field>
          </>
        )}
        {source === "trello" && (
          <>
            <Field label="API Key" id="apiKey">
              <Input value={(config.apiKey as string) ?? ""} onChange={(e) => update("apiKey", e.target.value)} placeholder="Trello API key" />
            </Field>
            <Field label="API Token" id="apiToken">
              <Input type="password" value={(config.apiToken as string) ?? ""} onChange={(e) => update("apiToken", e.target.value)} placeholder="Trello token" />
            </Field>
          </>
        )}
        {source === "csv" && (
          <Field label="Conteúdo do CSV" id="content">
            <Textarea
              value={(config.content as string) ?? ""}
              onChange={(e) => update("content", e.target.value)}
              placeholder={`type,title,description,status,team,sprint,storyPoints,parentTitle\nepic,Meu Épico,...`}
              rows={8}
              className="font-mono text-xs"
            />
          </Field>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleTest} disabled={isPending}>
            {status === "testing" ? "Testando..." : "Testar conexão"}
          </Button>
          {status === "ok" && <span className="flex items-center gap-1.5 text-sm text-green-600"><CheckCircle2Icon className="h-4 w-4" /> Conectado</span>}
          {status === "error" && <span className="flex items-center gap-1.5 text-sm text-destructive"><XCircleIcon className="h-4 w-4" /> {errorMsg}</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create `step-discovery.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/components/steps/step-discovery.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/design-system/components/ui/select";
import { Badge } from "@repo/design-system/components/ui/badge";
import { SearchIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";
import type { MappingRule } from "@/lib/migration/types";

interface DiscoveryProject { id?: string; key?: string; name: string }

export interface DiscoveryFormData { connectionId: string; mappingData: MappingRule[]; itemCount: number }

interface Props {
  connectionId: string;
  source: string;
  artNames: string[];
  defaultValues?: Partial<DiscoveryFormData>;
  onChange: (data: DiscoveryFormData) => void;
}

export function StepDiscovery({ connectionId, source, artNames, onChange }: Props) {
  const [projects, setProjects] = useState<DiscoveryProject[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [itemCount, setItemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!connectionId) return;
    startTransition(async () => {
      setLoading(true);
      const res = await fetch(`/api/migration/${source}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { projects: DiscoveryProject[]; itemCount: number };
        setProjects(data.projects);
        setItemCount(data.itemCount);
        // Default mapping: map all projects to first ART
        const defaultMapping: Record<string, string> = {};
        for (const p of data.projects) defaultMapping[p.name] = artNames[0] ?? "";
        setMapping(defaultMapping);
        const rules = Object.entries(defaultMapping).map(([sourceKey, targetName]) => ({ sourceKey, targetType: "art" as const, targetName }));
        onChange({ connectionId, mappingData: rules, itemCount: data.itemCount });
      }
      setLoading(false);
    });
  }, [connectionId, source]);

  function updateMapping(projectName: string, artName: string) {
    const next = { ...mapping, [projectName]: artName };
    setMapping(next);
    const rules = Object.entries(next).map(([sourceKey, targetName]) => ({ sourceKey, targetType: "art" as const, targetName }));
    onChange({ connectionId, mappingData: rules, itemCount });
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader icon={<SearchIcon className="h-5 w-5" />} title="Mapeamento de projetos" description="Mapeie cada projeto/board para o ART ou Value Stream correspondente no COSMOS." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Descobrindo projetos...</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{projects.length} projeto(s)</span>
            <span>·</span>
            <span>{itemCount} itens encontrados</span>
          </div>
          {projects.map((p) => (
            <div key={p.name} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.key && <p className="text-xs text-muted-foreground">{p.key}</p>}
              </div>
              <span className="text-muted-foreground text-xs">→</span>
              <Select value={mapping[p.name] ?? ""} onValueChange={(v) => updateMapping(p.name, v)}>
                <SelectTrigger className="w-44 text-xs">
                  <SelectValue placeholder="Selecionar ART" />
                </SelectTrigger>
                <SelectContent>
                  {artNames.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create `step-dry-run.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/components/steps/step-dry-run.tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { ShieldCheckIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";
import type { DryRunResult, MappingRule } from "@/lib/migration/types";

interface Props {
  connectionId: string;
  source: string;
  mappingData: MappingRule[];
  onResult: (result: DryRunResult) => void;
}

export function StepDryRun({ connectionId, source, mappingData, onResult }: Props) {
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/migration/${source}/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, mappingData }),
    }).then(async (res) => {
      if (res.ok) {
        const data = (await res.json()) as DryRunResult;
        setResult(data);
        onResult(data);
      }
      setLoading(false);
    });
  }, [connectionId, source]);

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader icon={<ShieldCheckIcon className="h-5 w-5" />} title="Simulação de importação" description="Veja o impacto antes de confirmar. Nada é criado nesta etapa." />
      {loading ? <p className="text-sm text-muted-foreground">Simulando...</p> : result && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[["Épicos", result.counts.epics], ["Stories", result.counts.stories], ["Teams", result.counts.teams]].map(([label, count]) => (
              <div key={label as string} className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {result.conflicts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-amber-600">⚠️ {result.conflicts.length} conflito(s) encontrado(s)</p>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                {result.conflicts.map((c, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="truncate">{c.item}</span>
                    <span className="shrink-0 text-amber-600">— {c.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.conflicts.length === 0 && (
            <p className="text-sm text-green-600">✅ Nenhum conflito detectado. Pronto para importar.</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `step-import.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/components/steps/step-import.tsx
"use client";

import { useState } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { DownloadIcon, CheckCircle2Icon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";
import type { ImportReport, MappingRule } from "@/lib/migration/types";

interface Props {
  connectionId: string;
  source: string;
  mappingData: MappingRule[];
  onComplete: (report: ImportReport) => void;
}

export function StepImport({ connectionId, source, mappingData, onComplete }: Props) {
  const [status, setStatus] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function runImport() {
    setStatus("importing");
    try {
      const res = await fetch(`/api/migration/${source}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, mappingData }),
      });
      const data = (await res.json()) as ImportReport | { error: string };
      if (!res.ok || "error" in data) throw new Error(("error" in data ? data.error : null) ?? "Import failed");
      setReport(data as ImportReport);
      setStatus("done");
      onComplete(data as ImportReport);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader icon={<DownloadIcon className="h-5 w-5" />} title="Importar dados" description="Esta operação criará épicos, stories e times no COSMOS." />
      {status === "idle" && (
        <Button onClick={runImport}>Iniciar importação</Button>
      )}
      {status === "importing" && (
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Importando...</span>
        </div>
      )}
      {status === "done" && report && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2Icon className="h-5 w-5" />
            <span className="font-medium">Importação concluída</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Épicos criados" value={report.created.epics} />
            <Stat label="Stories criadas" value={report.created.stories} />
            <Stat label="Erros" value={report.errors.length} />
          </div>
        </div>
      )}
      {status === "error" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
```

- [ ] **Step 6: Create `step-post-migration.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/components/steps/step-post-migration.tsx
"use client";

import { CheckCircle2Icon, AlertCircleIcon } from "lucide-react";
import { WizardStepHeader } from "@/app/(authenticated)/components/wizard-ui";
import type { ImportReport } from "@/lib/migration/types";

interface Props { report: ImportReport }

export function StepPostMigration({ report }: Props) {
  const hasErrors = report.errors.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={hasErrors ? <AlertCircleIcon className="h-5 w-5 text-amber-500" /> : <CheckCircle2Icon className="h-5 w-5 text-green-500" />}
        title="Resultado da migração"
        description="Verifique o que foi importado e trate eventuais erros manualmente."
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3"><p className="font-bold text-2xl">{report.created.epics}</p><p className="text-xs text-muted-foreground">épicos criados</p></div>
        <div className="rounded-lg border p-3"><p className="font-bold text-2xl">{report.created.stories}</p><p className="text-xs text-muted-foreground">stories criadas</p></div>
        <div className="rounded-lg border p-3"><p className="font-bold text-2xl">{report.totalProcessed}</p><p className="text-xs text-muted-foreground">itens processados</p></div>
        <div className="rounded-lg border p-3"><p className={`font-bold text-2xl ${hasErrors ? "text-amber-600" : "text-green-600"}`}>{report.errors.length}</p><p className="text-xs text-muted-foreground">erros</p></div>
      </div>
      {hasErrors && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Itens com erro (para revisão manual):</p>
          <div className="max-h-48 overflow-y-auto rounded-lg border p-3 flex flex-col gap-1">
            {report.errors.map((e, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium">{e.item}</span>
                <span className="text-muted-foreground"> — {e.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit steps**

```bash
git add apps/app/app/(authenticated)/onboarding/migration/components/steps/
git commit -m "feat(migration): all 6 migration wizard step components"
```

---

## Task 6: Migration wizard orchestrator + pages

**Files:**
- Create: `migration-wizard-client.tsx`, `migration/page.tsx`, `migration/complete/page.tsx`

- [ ] **Step 1: Create `migration-wizard-client.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/components/migration-wizard-client.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OnboardingWizardShell, type WizardStepMeta } from "../../company/components/onboarding-wizard-shell";
import { StepSourceSelect, type MigrationSource, type SourceSelectFormData } from "./steps/step-source-select";
import { StepConnectIntegration, type ConnectFormData } from "./steps/step-connect-integration";
import { StepDiscovery, type DiscoveryFormData } from "./steps/step-discovery";
import { StepDryRun } from "./steps/step-dry-run";
import { StepImport } from "./steps/step-import";
import { StepPostMigration } from "./steps/step-post-migration";
import { saveStep, completeFlow } from "@/app/actions/onboarding/index";
import { approveMigrationMapping } from "@/app/actions/onboarding/migration";
import type { DryRunResult, ImportReport, MappingRule } from "@/lib/migration/types";

const STEPS: WizardStepMeta[] = [
  { key: "source_select", label: "Origem" },
  { key: "connect", label: "Conexão" },
  { key: "discovery", label: "Descoberta" },
  { key: "dry_run", label: "Preview" },
  { key: "import", label: "Import" },
  { key: "post_migration", label: "Resultado" },
];

interface Props {
  initialStep: number;
  completedSteps: string[];
  savedData: Record<string, unknown>;
  artNames: string[];
}

export function MigrationWizardClient({ initialStep, completedSteps: initialCompleted, savedData, artNames }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(Math.min(initialStep, STEPS.length - 1));
  const [completedSteps, setCompletedSteps] = useState<string[]>(initialCompleted);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<MigrationSource>((savedData.source_select as SourceSelectFormData)?.source ?? "csv");
  const [connectData, setConnectData] = useState<ConnectFormData | null>((savedData.connect as ConnectFormData) ?? null);
  const [discoveryData, setDiscoveryData] = useState<DiscoveryFormData | null>((savedData.discovery as DiscoveryFormData) ?? null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>((savedData.dry_run as DryRunResult) ?? null);
  const [importReport, setImportReport] = useState<ImportReport | null>((savedData.import as ImportReport) ?? null);

  const stepKey = STEPS[currentStep].key;

  function handleNext() {
    setError(null);
    startTransition(async () => {
      try {
        await saveStep({ flowType: "migration_setup", stepKey, stepIndex: currentStep, data: getStepData() as Record<string, unknown> });
        setCompletedSteps((prev) => prev.includes(stepKey) ? prev : [...prev, stepKey]);

        if (stepKey === "discovery" && connectData?.connectionId && discoveryData?.mappingData) {
          await approveMigrationMapping(connectData.connectionId, discoveryData.mappingData);
        }

        if (currentStep < STEPS.length - 1) {
          setCurrentStep((s) => s + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro. Tente novamente.");
      }
    });
  }

  function handleComplete() {
    startTransition(async () => {
      try {
        await completeFlow("migration_setup");
        router.push("/onboarding/migration/complete");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao finalizar.");
      }
    });
  }

  function getStepData(): unknown {
    switch (stepKey) {
      case "source_select": return { source };
      case "connect": return connectData ?? {};
      case "discovery": return discoveryData ?? {};
      case "dry_run": return dryRunResult ?? {};
      case "import": return importReport ?? {};
      case "post_migration": return importReport ?? {};
      default: return {};
    }
  }

  const isLastStep = currentStep === STEPS.length - 1;

  // Determine if next is blocked
  const nextDisabled =
    (stepKey === "connect" && !connectData?.connectionId) ||
    (stepKey === "discovery" && !discoveryData?.connectionId) ||
    (stepKey === "import" && !importReport);

  return (
    <OnboardingWizardShell
      steps={STEPS}
      currentStep={currentStep}
      completedSteps={completedSteps}
      onBack={() => setCurrentStep((s) => Math.max(s - 1, 0))}
      onNext={isLastStep ? handleComplete : handleNext}
      isNextDisabled={nextDisabled}
      isSaving={isPending}
      nextLabel={isLastStep ? "Concluir migração" : undefined}
    >
      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {stepKey === "source_select"  && <StepSourceSelect defaultValues={{ source }} onChange={(d) => setSource(d.source)} />}
      {stepKey === "connect"        && <StepConnectIntegration source={source} defaultValues={connectData ?? undefined} onConnected={setConnectData} />}
      {stepKey === "discovery"      && <StepDiscovery connectionId={connectData?.connectionId ?? ""} source={source} artNames={artNames} onChange={setDiscoveryData} />}
      {stepKey === "dry_run"        && <StepDryRun connectionId={connectData?.connectionId ?? ""} source={source} mappingData={discoveryData?.mappingData ?? []} onResult={setDryRunResult} />}
      {stepKey === "import"         && <StepImport connectionId={connectData?.connectionId ?? ""} source={source} mappingData={discoveryData?.mappingData ?? []} onComplete={setImportReport} />}
      {stepKey === "post_migration" && importReport && <StepPostMigration report={importReport} />}
    </OnboardingWizardShell>
  );
}
```

- [ ] **Step 2: Create `migration/page.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/page.tsx
import { getOrCreateProgress } from "@/app/actions/onboarding/index";
import { getARTs } from "@/app/actions/arts/get-arts";
import { redirect } from "next/navigation";
import { MigrationWizardClient } from "./components/migration-wizard-client";

export default async function MigrationSetupPage() {
  const progress = await getOrCreateProgress("migration_setup");

  if (progress.status === "completed") {
    redirect("/onboarding/migration/complete");
  }

  const arts = await getARTs();
  const artNames = arts.map((a) => a.name);
  const savedData = (progress.data as Record<string, unknown>) ?? {};

  return (
    <MigrationWizardClient
      initialStep={progress.currentStep}
      completedSteps={progress.completedSteps}
      savedData={savedData}
      artNames={artNames}
    />
  );
}
```

- [ ] **Step 3: Create `migration/complete/page.tsx`**

```typescript
// apps/app/app/(authenticated)/onboarding/migration/complete/page.tsx
import Link from "next/link";
import { Button } from "@repo/design-system/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";

export default function MigrationCompletePage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 text-center">
      <CheckCircle2Icon className="h-16 w-16 text-green-500" />
      <div>
        <h1 className="text-3xl font-bold mb-2">Migração concluída!</h1>
        <p className="text-muted-foreground max-w-md">
          Seus dados foram importados para o COSMOS. Revise os épicos e times no portfólio.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/portfolio">Ver portfólio</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Ir para o Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "migration" | head -20
```

Expected: no errors or only pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/(authenticated)/onboarding/migration/
git commit -m "feat(migration): migration_setup wizard orchestrator + pages"
```

---

## Task 7: End-to-end smoke test (migration)

- [ ] **Step 1: Test CSV migration**

1. Navigate to `/onboarding/migration`.
2. Step 1: Select "CSV genérico".
3. Step 2: Paste CSV:
```
type,title,description,status,team,sprint,storyPoints,parentTitle
epic,Epic de Pagamentos,Pagamentos online,BACKLOG,,,0,
story,Login via Pix,,TODO,Team Alpha,Sprint 1,3,Epic de Pagamentos
story,Checkout,,TODO,Team Alpha,Sprint 1,5,Epic de Pagamentos
```
Click "Testar conexão" → expect "Conectado".
4. Step 3: Discovery shows 1 project "CSV Import", map to an ART.
5. Step 4: Dry-run shows 1 epic + 2 stories, 0 conflicts.
6. Step 5: Click "Iniciar importação" → shows "Importação concluída", 1 épico + 2 stories.
7. Step 6: Post-migration report shows correct numbers.
8. "Concluir migração" → redirects to `/onboarding/migration/complete`.

- [ ] **Step 2: Verify entities created**

Check `/portfolio` → new epic "Epic de Pagamentos" should appear.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(migration): migration_setup flow complete — CSV + Jira + Azure + Trello"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| `MigrationConnection` DB model | Plan 1 Task 1 |
| `saveMigrationConnection`, `approveMigrationMapping` | Task 3 |
| CSV parser | Task 1 |
| Jira, Azure, Trello client helpers | Task 2 |
| `/api/migration/[source]/connect` | Task 4 |
| `/api/migration/[source]/discover` | Task 4 |
| `/api/migration/[source]/dry-run` | Task 4 |
| `/api/migration/[source]/import` | Task 4 |
| 6-step migration wizard UI | Task 5 |
| Migration orchestrator + pages | Task 6 |
| CSV smoke test | Task 7 |
| Jira/Azure/Trello (require real credentials for manual testing) | Task 2 + Task 4 |
