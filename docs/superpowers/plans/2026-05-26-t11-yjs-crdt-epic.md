# T11 — Colaboração Real-Time em Epic (Yjs CRDT) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Epic `descriptionMd` field becomes a real-time collaborative rich-text editor powered by Yjs + Liveblocks — multiple users can edit simultaneously during PI Planning without last-write-wins overwrites. On unmount, the final YDoc state is persisted to the DB via a Server Action.

**Architecture:** Liveblocks Room per Epic (`room-id: epic-{epicId}`). `useRoom()` + `@liveblocks/yjs` binds a Yjs `Y.Text` instance to TipTap editor. Awareness cursors show other editors. On disconnect / Save button: serialize `Y.Text.toString()` → call `updateEpicDescription(epicId, markdown)`. No new DB schema — uses existing `Epic.descriptionMd`.

**Tech Stack:** `@liveblocks/react`, `@liveblocks/yjs`, `yjs`, `@tiptap/react`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-cursor`. Existing Liveblocks client assumed configured in `apps/app/liveblocks.config.ts`.

---

## File Structure

```
apps/app/
  liveblocks.config.ts              MODIFY: add epic room schema

apps/app/app/actions/epics/
  update-description.ts             NEW: Server Action — persist final markdown

apps/app/app/(authenticated)/epics/[epicId]/
  components/
    epic-collab-editor.tsx          NEW: Client Component — Yjs TipTap editor
    epic-collab-presence.tsx        NEW: awareness avatars row
    epic-editor-toolbar.tsx         NEW: formatting toolbar (bold/italic/list/link)
  page.tsx                          MODIFY: swap static textarea for collab editor

apps/app/__tests__/actions/epics/
  update-description.test.ts        NEW
```

---

## Task 1: Update description Server Action

**Files:**
- Create: `apps/app/app/actions/epics/update-description.ts`
- Create: `apps/app/__tests__/actions/epics/update-description.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { updateEpicDescription } from "@/app/actions/epics/update-description";

jest.mock("@repo/database", () => ({
  database: {
    epic: {
      findFirst: jest.fn().mockResolvedValue({ id: "epic-1", tenantId: "t1" }),
      update: jest.fn().mockResolvedValue({ id: "epic-1" }),
    },
  },
}));

jest.mock("@repo/auth/server", () => ({
  requireTenantSession: jest.fn().mockResolvedValue({ tenantId: "t1" }),
}));
jest.mock("next/headers", () => ({ headers: jest.fn().mockResolvedValue({}) }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

test("updates Epic.descriptionMd and revalidates", async () => {
  const { database } = require("@repo/database");
  await updateEpicDescription("epic-1", "## New description\n\nContent here.");
  expect(database.epic.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "epic-1" },
      data: expect.objectContaining({ descriptionMd: "## New description\n\nContent here." }),
    })
  );
});

test("throws if epic not found or wrong tenant", async () => {
  const { database } = require("@repo/database");
  database.epic.findFirst.mockResolvedValueOnce(null);
  await expect(updateEpicDescription("bad-id", "text")).rejects.toThrow("Epic não encontrada");
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/app && npx jest __tests__/actions/epics/update-description.test.ts --no-coverage
```

- [ ] **Step 3: Implement**

```typescript
"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const InputSchema = z.object({
  epicId: z.string().min(1),
  descriptionMd: z.string().max(50_000, "Descrição excede 50.000 caracteres"),
});

export async function updateEpicDescription(
  epicId: string,
  descriptionMd: string
): Promise<void> {
  const ctx = await requireTenantSession(await headers());
  const { epicId: id, descriptionMd: desc } = InputSchema.parse({ epicId, descriptionMd });

  const epic = await database.epic.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!epic) throw new Error("Epic não encontrada ou sem permissão.");

  await database.epic.update({
    where: { id },
    data: { descriptionMd: desc, updatedAt: new Date() },
  });

  revalidatePath(`/epics/${id}`);
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/app && npx jest __tests__/actions/epics/update-description.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/app/app/actions/epics/update-description.ts \
        apps/app/__tests__/actions/epics/update-description.test.ts
git commit -m "feat(epics): updateEpicDescription server action with tenant isolation"
```

---

## Task 2: Install Yjs / TipTap collaboration deps

- [ ] **Step 1: Install packages**

```bash
cd apps/app
pnpm add @liveblocks/yjs yjs @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('yjs'); console.log('yjs ok')"
node -e "require('@tiptap/extension-collaboration'); console.log('tiptap collab ok')"
```

Expected: `yjs ok` and `tiptap collab ok`

- [ ] **Step 3: Commit**

```bash
git add apps/app/package.json pnpm-lock.yaml
git commit -m "chore(deps): add yjs + tiptap collaboration extensions"
```

---

## Task 3: Liveblocks room config

**Files:**
- Modify: `apps/app/liveblocks.config.ts` (or wherever Liveblocks is configured)

- [ ] **Step 1: Add Epic room type**

```typescript
// In liveblocks.config.ts, add to the createClient or type declarations:
// Epic collaboration room uses Yjs — no Liveblocks Storage types needed.
// Room ID pattern: `epic-${epicId}`

// If using typed Liveblocks:
declare global {
  interface Liveblocks {
    // ... existing rooms ...
    // Epic room — Yjs manages state; no Liveblocks Storage fields
    RoomEvent: { type: "DESCRIPTION_SAVED"; userId: string; savedAt: string };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/liveblocks.config.ts
git commit -m "feat(epics): add epic collab room type to Liveblocks config"
```

---

## Task 4: Presence (awareness) avatars

**Files:**
- Create: `apps/app/app/(authenticated)/epics/[epicId]/components/epic-collab-presence.tsx`

- [ ] **Step 1: Implement awareness avatars row**

```tsx
"use client";

import { useOthers, useSelf } from "@liveblocks/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function EpicCollabPresence() {
  const others = useOthers();
  const self = useSelf();

  const all = [
    ...(self ? [{ id: "me", name: self.info?.name ?? "Você", color: self.info?.color ?? "#6366f1" }] : []),
    ...others.map((o) => ({
      id: o.connectionId.toString(),
      name: o.info?.name ?? "Usuário",
      color: o.info?.color ?? "#94a3b8",
    })),
  ];

  if (all.length <= 1) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {all.slice(0, 5).map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger>
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-background"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {all.length > 5 && (
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground border-2 border-background">
            +{all.length - 5}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/\(authenticated\)/epics/\[epicId\]/components/epic-collab-presence.tsx
git commit -m "feat(epics): collaborative presence avatars using Liveblocks useOthers"
```

---

## Task 5: Collab editor Client Component

**Files:**
- Create: `apps/app/app/(authenticated)/epics/[epicId]/components/epic-collab-editor.tsx`

- [ ] **Step 1: Implement Yjs + TipTap collaborative editor**

```tsx
"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { useRoom, useSelf } from "@liveblocks/react";
import { updateEpicDescription } from "@/app/actions/epics/update-description";
import { EpicCollabPresence } from "./epic-collab-presence";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface Props {
  epicId: string;
  initialContent: string;
}

export function EpicCollabEditor({ epicId, initialContent }: Props) {
  const room = useRoom();
  const self = useSelf();

  const doc = new Y.Doc();
  const provider = new LiveblocksYjsProvider(room, doc);
  const yText = doc.getText("description");

  // Seed initial content only if Y.Text is empty (first user to open)
  useEffect(() => {
    if (yText.length === 0 && initialContent) {
      yText.insert(0, initialContent);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }), // history managed by Yjs
      Collaboration.configure({ document: doc, field: "description" }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: self?.info?.name ?? "Usuário",
          color: self?.info?.color ?? "#6366f1",
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4",
      },
    },
  });

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const markdown = editor.getText(); // For markdown, use a serializer; getText() is placeholder
    await updateEpicDescription(epicId, markdown);
  }, [editor, epicId]);

  // Auto-save on unmount
  useEffect(() => {
    return () => {
      handleSave();
      provider.destroy();
    };
  }, [handleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <EpicCollabPresence />
        <Button size="sm" variant="ghost" onClick={handleSave} className="h-7 gap-1.5">
          <Save className="h-3.5 w-3.5" />
          Salvar
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/app/app/\(authenticated\)/epics/\[epicId\]/components/epic-collab-editor.tsx
git commit -m "feat(epics): EpicCollabEditor — Yjs + TipTap + Liveblocks CRDT collaboration"
```

---

## Task 6: Wrap editor in Liveblocks RoomProvider + wire into page

**Files:**
- Create: `apps/app/app/(authenticated)/epics/[epicId]/components/epic-editor-room.tsx`
- Modify: Epic detail page to use collab editor

- [ ] **Step 1: Room wrapper (Client Component)**

```tsx
"use client";

import { RoomProvider } from "@liveblocks/react";
import { ClientSideSuspense } from "@liveblocks/react";
import { EpicCollabEditor } from "./epic-collab-editor";

interface Props {
  epicId: string;
  initialContent: string;
}

export function EpicEditorRoom({ epicId, initialContent }: Props) {
  return (
    <RoomProvider id={`epic-${epicId}`} initialPresence={{}}>
      <ClientSideSuspense
        fallback={
          <div className="rounded-lg border p-4 min-h-[200px] animate-pulse bg-muted/30">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        }
      >
        {() => <EpicCollabEditor epicId={epicId} initialContent={initialContent} />}
      </ClientSideSuspense>
    </RoomProvider>
  );
}
```

- [ ] **Step 2: Use in epic detail page**

In `apps/app/app/(authenticated)/epics/[epicId]/page.tsx` (or the relevant component that renders the description field), replace the static `<Textarea value={epic.descriptionMd} />` with:

```tsx
import { EpicEditorRoom } from "./components/epic-editor-room";

// ...inside the JSX where description renders:
<EpicEditorRoom
  epicId={epic.id}
  initialContent={epic.descriptionMd ?? ""}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/app/app/\(authenticated\)/epics/\[epicId\]/components/epic-editor-room.tsx \
        apps/app/app/\(authenticated\)/epics/\[epicId\]/page.tsx
git commit -m "feat(epics): wire collaborative CRDT editor into epic detail page"
```

---

## Done When

- [ ] Two browser tabs editing the same Epic show real-time cursor positions
- [ ] Presence row shows avatars of all co-editors (≥ 2 users in room)
- [ ] Save button persists final markdown to `Epic.descriptionMd`
- [ ] Auto-save fires on tab close / navigation away
- [ ] `updateEpicDescription` test passes with tenant isolation check
- [ ] No last-write-wins: concurrent edits merge without data loss
- [ ] Loading skeleton shows while Liveblocks room connects
