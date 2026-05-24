# PRD — Copilot UI: Alinhamento com llmchat

> **Referência:** https://github.com/trendy-design/llmchat  
> **Data:** 2026-05-24  
> **Escopo:** `apps/app/app/(authenticated)/copilot/**` + `apps/app/app/(authenticated)/components/copilot/**`

---

## Objetivo

Transformar a interface do Cosmos Copilot para seguir os padrões de UX do llmchat:
layout centrado (sem chat bubbles), steps timeline para tool calls, input TipTap,
sidebar colapsável com agrupamento temporal, e side drawer para tool results/fontes.

**Não mudar:** backend (tools.ts, context/, route.ts), lógica de sessão, autenticação, quota.

---

## Estado Atual

```
CopilotFullscreen
├── SessionSidebar          — lista simples, sem colapso, sem agrupamento
├── Header                  — gradient, mode selector, sync button
├── CopilotChat             — chat bubbles, ReactMarkdown direto
│   └── MessageBubble       — user=violet, AI=gray bubble
└── InputForm               — <Textarea> + upload botão + send botão
```

**Streaming:** `toTextStreamResponse()` → só texto, tool calls invisíveis no UI.  
**State:** `useState` local, `useCopilotChat` wraps Vercel AI SDK `useChat`.

---

## Estado Alvo

```
CopilotLayout
├── CopilotSidebar          — collapsible (240px ↔ icon rail), time-grouped, pin
│   └── [Vaul Drawer]       — mobile only
├── CopilotMain
│   ├── CopilotHeader       — modo como chips, sync, user actions
│   ├── CopilotThread       — max-w-3xl centered, use-stick-to-bottom
│   │   └── CopilotThreadItem (per message pair)
│   │       ├── UserMessage — colapsável se > 120px
│   │       ├── StepsTimeline — dashed line + status dot por tool call
│   │       ├── ToolCallStep (accordion, args como JSON)
│   │       ├── AssistantMessage — prose markdown
│   │       └── FollowupSuggestions
│   └── CopilotInputArea
│       ├── TipTapEditor    — Enter=submit, Shift+Enter=newline
│       ├── AttachButton
│       └── SendStopButton
└── CopilotSideDrawer       — right panel 500px, spring animation, render-prop
```

**Streaming:** migrar para `toDataStreamResponse()` → tool call events chegam no UI.

---

## Fases de Implementação

---

### Fase 1 — Message Layout (sem mudança de backend)

**Objetivo:** Remover chat bubbles, centrar conteúdo, melhorar markdown, animações.

**Estimativa:** 1-2 dias

#### Arquivos

| Arquivo | Ação |
|---|---|
| `components/copilot/copilot-chat.tsx` | Reescrever — remover bubbles, layout max-w-3xl |
| `components/copilot/copilot-thread-item.tsx` | Criar — componente por par user+AI |
| `components/copilot/copilot-markdown.tsx` | Criar — prose styles, code blocks melhorados |
| `components/copilot/use-stick-to-bottom.ts` | Criar — hook scroll (ou instalar lib) |

#### Spec

**CopilotChat (novo):**
```tsx
// Container
<div className="flex-1 overflow-y-auto no-scrollbar" ref={scrollRef}>
  <div className="max-w-3xl mx-auto pb-[200px] px-4">
    {messages.map(msg => <CopilotThreadItem key={msg.id} ... />)}
    {isThinking && <ThinkingShimmer />}
  </div>
</div>
```

**CopilotThreadItem:**
```tsx
// User message — texto simples, colapsável > 120px
<div className="mb-2 text-sm text-right text-muted-foreground">{query}</div>

// Label "Resposta"
<div className="flex items-center gap-2 mb-2">
  <BookOpenIcon className="h-3.5 w-3.5" />
  <span className="text-xs font-medium">Resposta</span>
</div>

// AI answer — prose markdown
<CopilotMarkdown content={answer} isStreaming={isStreaming} />

// Streaming cursor
{isStreaming && <span className="animate-pulse text-cyan-400 ml-0.5">▍</span>}
```

**Animações (framer-motion):**
```tsx
// Cada novo ThreadItem entra com:
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.2 }}
```

**use-stick-to-bottom:**
```ts
// Instalar: pnpm add use-stick-to-bottom (ou implementar hook simples)
// Attaches scrollRef; sticks durante geração; detaches se user scrollar up
```

#### Dependências novas
- `framer-motion` (verificar se já existe no workspace)
- `use-stick-to-bottom` OU implementar hook manual

---

### Fase 2 — Tool Calls / Steps Timeline

**Objetivo:** Tornar tool calls visíveis. Maior gap de UX atual.

**Estimativa:** 2-3 dias

#### Mudança de Backend

**`apps/app/app/api/copilot/chat/route.ts`:**
```ts
// Antes:
return result.toTextStreamResponse();

// Depois:
return result.toDataStreamResponse();
```

`toDataStreamResponse()` emite automaticamente (Vercel AI SDK):
- `9:` — tool call start (nome, id, args parciais)
- `a:` — tool result
- `0:` — text delta
- `e:` / `d:` — finish

**`components/copilot/use-copilot-chat.ts`:**
```ts
// Adicionar: useChat já lida com toolInvocations quando streaming é data stream
// messages[n].toolInvocations: Array<{ toolCallId, toolName, args, state, result }>
```

#### Arquivos

| Arquivo | Ação |
|---|---|
| `apps/app/app/api/copilot/chat/route.ts` | Modificar — `toDataStreamResponse()` |
| `components/copilot/use-copilot-chat.ts` | Modificar — expor `toolInvocations` |
| `components/copilot/copilot-steps-timeline.tsx` | Criar — timeline component |
| `components/copilot/copilot-tool-call-step.tsx` | Criar — accordion com args/result |

#### Spec

**CopilotStepsTimeline:**
```tsx
// Left dashed timeline
<div className="relative pl-5 border-l border-dashed border-border/50 flex flex-col gap-2">
  {toolInvocations.map(inv => (
    <CopilotToolCallStep key={inv.toolCallId} invocation={inv} />
  ))}
</div>
```

**CopilotToolCallStep:**
```tsx
// Estado: 'partial-call' | 'call' | 'result'
// Header: ícone status dot + nome da tool + badge
// Expand: JSON.stringify(args, null, 2) em code block
// Result: JSON.stringify(result, null, 2) em code block (quando state === 'result')

type StepStatus = 'pending' | 'running' | 'done' | 'error'

// Status dot cores:
// pending: bg-muted
// running: bg-blue-400 animate-pulse
// done: bg-green-400
// error: bg-red-400
```

**Tool name → label map** (PT-BR):
```ts
const TOOL_LABELS: Record<string, string> = {
  queryARTs:          "Consultando ARTs",
  queryTeams:         "Consultando Times",
  queryEpics:         "Consultando Épicos",
  queryOKRs:          "Consultando OKRs",
  queryFlowMetrics:   "Analisando Flow Metrics",
  queryLeanBudget:    "Verificando Budget",
  queryProgramBoard:  "Consultando Program Board",
  queryRiskVectors:   "Analisando Riscos",
  searchKnowledge:    "Pesquisando Base de Conhecimento",
  createFeature:      "Criando Feature",
  moveFeature:        "Movendo Feature",
  navigate_to:        "Navegando",
};
```

**CopilotThreadItem (atualizado):**
```tsx
<div>
  <UserMessage query={msg.query} />
  
  {/* Steps timeline — aparece durante e após geração */}
  {toolInvocations.length > 0 && (
    <CopilotStepsTimeline invocations={toolInvocations} />
  )}
  
  {/* Resposta */}
  {answer && (
    <>
      <AnswerLabel />
      <CopilotMarkdown content={answer} isStreaming={isCurrentStreaming} />
    </>
  )}
  
  {/* Sugestões */}
  {!isStreaming && <CopilotSuggestions content={answer} />}
</div>
```

---

### Fase 3 — TipTap Input

**Objetivo:** Input rico, melhor UX de texto, atalhos de teclado nativos.

**Estimativa:** 1 dia

#### Arquivos

| Arquivo | Ação |
|---|---|
| `components/copilot/copilot-input.tsx` | Criar — substitui `<form>` com `<Textarea>` |
| `components/copilot/copilot-tiptap-editor.tsx` | Criar — wrapper TipTap |

#### Dependências
```bash
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
```

#### Spec

**CopilotTipTapEditor:**
```tsx
const editor = useEditor({
  extensions: [
    StarterKit.configure({ history: false }),
    Placeholder.configure({ placeholder: "Pergunte sobre seus dados..." }),
  ],
  editorProps: {
    handleKeyDown: (view, event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSubmit(editor?.getText() ?? '');
        editor?.commands.clearContent();
        return true;
      }
      return false;
    },
  },
  onUpdate: ({ editor }) => onChange(editor.getText()),
});
```

**CopilotInputArea:**
```tsx
<div className="border rounded-xl bg-background shadow-sm">
  <CopilotTipTapEditor onChange={setInput} onSubmit={handleSubmit} disabled={isLoading} />
  <div className="flex items-center justify-between px-3 pb-2">
    <div className="flex gap-2">
      <AttachButton onFile={handleFileUpload} disabled={isLoading} />
      <ModeChips mode={mode} onModeChange={setMode} />  {/* move do header */}
    </div>
    <SendStopButton isLoading={isLoading} hasContent={!!input.trim()} />
  </div>
</div>
```

**ModeChips** (mover Select do header para aqui):
```tsx
// Chips pequenos, não Select dropdown
{MODES.map(m => (
  <button
    key={m.key}
    className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors",
      mode === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
    )}
    onClick={() => setMode(m.key)}
  >
    {m.short}  {/* "Global", "RTE", "LPM", etc */}
  </button>
))}
```

---

### Fase 4 — Sidebar Colapsável + Agrupamento Temporal

**Objetivo:** Sidebar que colapsa para icon rail, sessões agrupadas por data, pin/unpin.

**Estimativa:** 2 dias

#### Arquivos

| Arquivo | Ação |
|---|---|
| `copilot/components/session-sidebar.tsx` | Reescrever |
| `copilot/components/session-group.tsx` | Criar — grupo de sessões (Hoje, etc.) |
| `copilot/components/session-item.tsx` | Criar — item individual com pin |
| `packages/database/prisma/schema.prisma` | Adicionar `pinnedAt DateTime?` em `CopilotSession` |

#### Spec

**Agrupamento temporal:**
```ts
function groupSessions(sessions: SessionPreview[]): Record<string, SessionPreview[]> {
  const now = new Date();
  return sessions.reduce((acc, s) => {
    const diff = differenceInDays(now, s.createdAt);
    const label =
      diff === 0 ? 'Hoje' :
      diff === 1 ? 'Ontem' :
      diff <= 7  ? 'Últimos 7 dias' :
      diff <= 30 ? 'Últimos 30 dias' :
                   format(s.createdAt, 'MMMM yyyy', { locale: ptBR });
    acc[label] = [...(acc[label] ?? []), s];
    return acc;
  }, {} as Record<string, SessionPreview[]>);
}
```

**Colapso:**
```tsx
// Expanded: w-64 | Collapsed: w-14 (icon rail)
<aside className={cn(
  "flex h-full flex-col border-r bg-background transition-all duration-200",
  isOpen ? "w-64" : "w-14"
)}>
  {/* Toggle button */}
  <button onClick={toggle} className="p-3">
    {isOpen ? <PanelLeftClose /> : <PanelLeft />}
  </button>

  {/* Collapsed: só ícone de new chat */}
  {!isOpen && <NewChatIconButton onClick={onNew} />}

  {/* Expanded: lista completa */}
  {isOpen && (
    <>
      <NewChatButton onClick={onNew} />
      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([label, sessions]) => (
          <SessionGroup key={label} label={label} sessions={sessions} ... />
        ))}
      </div>
    </>
  )}
</aside>
```

**Pin/unpin:**
```ts
// Novo server action
export async function pinCopilotSession(sessionId: string): Promise<void>
export async function unpinCopilotSession(sessionId: string): Promise<void>

// Pinned sessions: próprio grupo "Fixadas" no topo
```

**Migration:**
```sql
ALTER TABLE "CopilotSession" ADD COLUMN "pinnedAt" TIMESTAMP;
```

**Mobile (Vaul):**
```tsx
// Usar vaul ou shadcn/ui Sheet
import { Sheet, SheetContent, SheetTrigger } from "@repo/design-system/components/ui/sheet";

// Em mobile (< lg): sidebar dentro de Sheet
// Em desktop (>= lg): sidebar sempre visível
```

#### Dependências
- `date-fns` (verificar se já no workspace)
- `vaul` OU usar `Sheet` do shadcn (já disponível)

---

### Fase 5 — Side Drawer (Tool Results / Fontes)

**Objetivo:** Panel lateral direito para detalhes de tool calls e knowledge sources.

**Estimativa:** 1 dia

#### Arquivos

| Arquivo | Ação |
|---|---|
| `copilot/components/copilot-side-drawer.tsx` | Criar |
| `copilot/hooks/use-copilot-drawer.ts` | Criar — Zustand slice ou Context |

#### Spec

**State:**
```ts
// Zustand store (ou Context simples)
type CopilotDrawerStore = {
  open: boolean;
  title: string;
  renderContent: (() => ReactNode) | null;
  openDrawer: (opts: { title: string; renderContent: () => ReactNode }) => void;
  closeDrawer: () => void;
};
```

**Layout com drawer:**
```tsx
// CopilotMain
<div className="flex flex-1 overflow-hidden">
  <div className="flex flex-1 flex-col overflow-hidden">
    {/* chat + input */}
  </div>

  {/* Side drawer */}
  <AnimatePresence>
    {drawerOpen && (
      <motion.div
        className="w-[420px] shrink-0 border-l flex flex-col overflow-hidden"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <DrawerHeader title={title} onClose={closeDrawer} />
        <div className="flex-1 overflow-y-auto p-4">
          {renderContent?.()}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</div>
```

**Triggers:**
- Clique em `CopilotToolCallStep` (resultado completo) → abre drawer com args+result formatados
- `searchKnowledge` tool result → abre drawer com lista de fontes
- Botão "Ver fontes" no footer de mensagem

---

## Ordem de Execução

```
Fase 1 (Layout)       → sem risco, sem deps, entrega visual imediata
Fase 2 (Tool Calls)   → maior impacto UX; requer mudar route.ts + hook
Fase 3 (TipTap)       → nova dep, isolar em componente próprio
Fase 4 (Sidebar)      → requer migration DB para pin; resto é UI
Fase 5 (Side Drawer)  → polish final; depende de Fase 2 (tem tool results)
```

**Recomendação:** implementar Fase 1 + Fase 2 primeiro (maior impacto), depois 3, 4, 5.

---

## Decisões Técnicas

| Decisão | Escolha | Motivo |
|---|---|---|
| Animações | `framer-motion` | Já deve estar no workspace (verificar); padrão llmchat |
| Scroll | `use-stick-to-bottom` | Lib pequena, resolve edge cases de scroll durante stream |
| Input | TipTap | Melhor UX que textarea; fácil keyboard handling |
| State drawer | Zustand slice | Acessível de qualquer componente filho |
| Mobile sidebar | shadcn `Sheet` | Já disponível no design system |
| Streaming | `toDataStreamResponse()` | Tool calls chegam automaticamente no `useChat` |
| Agrupamento | `date-fns` | Já no workspace (uso em outros lugares) |
| Pin storage | `CopilotSession.pinnedAt` | Já temos migration pipeline; simples |

---

## O que NÃO mudar

- `apps/app/app/api/copilot/chat/route.ts` — só linha `toDataStreamResponse()` na Fase 2
- `app/actions/safe-copilot/` — tools, context, sessions, quota: intocados
- `copilot/page.tsx` — shell Server Component: intocado
- Design tokens / cores (`violet-600`, `cyan-400`, `zinc`) — manter identidade visual
- Header gradient e branding "Cosmos Copilot" — manter

---

## Checklist por Fase

### Fase 1
- [ ] Instalar `framer-motion` e `use-stick-to-bottom`
- [ ] Criar `CopilotMarkdown` com prose styles
- [ ] Criar `CopilotThreadItem` (user message + AI answer, sem bubbles)
- [ ] Reescrever `CopilotChat` — max-w-3xl, use-stick-to-bottom, AnimatePresence
- [ ] Criar `ThinkingShimmer` substituindo `ThinkingIndicator` com frases
- [ ] Manter `CopilotReport` e `CopilotSuggestions` funcionando no novo layout

### Fase 2
- [ ] Mudar `toTextStreamResponse()` → `toDataStreamResponse()` no route.ts
- [ ] Atualizar `useCopilotChat` — expor `toolInvocations` de cada message
- [ ] Criar `CopilotToolCallStep` — accordion status dot + nome + args JSON
- [ ] Criar `CopilotStepsTimeline` — dashed left border, steps list
- [ ] Integrar timeline em `CopilotThreadItem` (entre user message e answer)
- [ ] Testar todos os tools: queryARTs, queryTeams, queryEpics, queryOKRs, searchKnowledge
- [ ] Atualizar tests (copilot-sessions.test.ts) se necessário

### Fase 3
- [ ] Adicionar deps TipTap
- [ ] Criar `CopilotTipTapEditor` com Enter=submit, Shift+Enter=newline
- [ ] Criar `ModeChips` (mover mode selector do header para input)
- [ ] Criar `CopilotInputArea` com TipTap + attach + send
- [ ] Remover `<form>` + `<Textarea>` do `CopilotFullscreen`
- [ ] Garantir paste de texto funciona corretamente

### Fase 4
- [ ] Criar migration `pinnedAt` no schema Prisma
- [ ] Criar `pinCopilotSession` / `unpinCopilotSession` server actions
- [ ] Criar `SessionGroup` — label + lista de items
- [ ] Criar `SessionItem` — hover → pin button aparece
- [ ] Reescrever `SessionSidebar` — collapsible, groups, mobile Sheet
- [ ] Adicionar `date-fns` se não disponível

### Fase 5
- [ ] Criar `useCopilotDrawer` Zustand hook
- [ ] Criar `CopilotSideDrawer` — framer-motion AnimatePresence, 420px
- [ ] Adicionar drawer trigger em `CopilotToolCallStep`
- [ ] Adicionar drawer trigger para `searchKnowledge` results
- [ ] Integrar drawer no layout principal

---

## Referências

- llmchat chat layout: `packages/common/components/layout/root.tsx`
- llmchat thread: `packages/common/components/thread/thread-combo.tsx`
- llmchat tool call: `packages/common/components/thread/components/tool-call.tsx`
- llmchat steps: `packages/common/components/thread/step-renderer.tsx`
- llmchat input: `packages/common/components/chat-input/input.tsx`
- llmchat sidebar: `packages/common/components/side-bar.tsx`
- llmchat side drawer: `useAppStore.sideDrawer` in `packages/common/store/`
