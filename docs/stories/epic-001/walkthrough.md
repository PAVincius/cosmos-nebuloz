# Story 001 — Walkthrough Log

**Date:** 2026-05-11  
**Story:** Configuração do Turborepo e Tailwind  
**Status:** ✅ Done  
**WSJF Score:** 20.0

---

## O Que Foi Instalado / Configurado

### 1. Dependências (`pnpm install`)
- Confirmado que cosmos-nebuloz já é um Next-Forge v5.3.2 inicializado
- `pnpm install` executado na raiz → instalou todos os workspaces
- `node_modules` populados via `pnpm-lock.yaml` existente

### 2. Design System — Linear Tokens (`packages/design-system/styles/globals.css`)
Tokens atualizados de neutros genéricos (shadcn default) para Linear/COSMOS:

**Dark mode** (modo primário, `oklch`):
| Variável | Valor | Corresponde a |
|----------|-------|---------------|
| `--background` | `oklch(0.09 0.003 280)` | Linear canvas ~#0f0f10 |
| `--card` | `oklch(0.14 0.005 280)` | surface-1 ~#1a1a1e |
| `--popover` | `oklch(0.18 0.007 280)` | surface-2 ~#222228 |
| `--accent` | `oklch(0.23 0.009 280)` | surface-3 ~#2a2a32 |
| `--primary` | `oklch(0.58 0.22 264)` | lavender-blue accent |
| `--muted-foreground` | `oklch(0.60 0.005 280)` | ink-subtle ~#8b8b94 |
| `--border` | `oklch(0.21 0.009 280)` | hairline ~#2a2a32 |
| `--ring` | `oklch(0.50 0.16 264)` | primary-focus #5e69d1 |

**COSMOS semantic tokens adicionados** (disponíveis como classes Tailwind via `@theme inline`):
- `--safe-epic`, `--safe-feature`, `--safe-story` — entidades SAFe
- `--roam-r`, `--roam-o`, `--roam-a`, `--roam-m` — níveis de risco ROAM
- `--pi-active`, `--pi-planning` — estados de PI
- `--wsjf-high`, `--wsjf-medium`, `--wsjf-low` — urgência WSJF
- `--color-surface-1/2/3`, `--color-canvas`, `--color-ink` — surface ladder direto

**Radius atualizado** para Linear spec:
- `--radius: 0.5rem` (8px base)
- `radius-sm` = 4px (chips/badges), `radius-md` = 8px (buttons), `radius-lg` = 12px (cards)

### 3. DESIGN.md instalada
```
npx getdesign@latest add linear.app
```
→ `DESIGN.md` na raiz com design system completo do Linear

### 4. `.env.local` criado (`apps/web/.env.local`)
Stubs mínimos válidos para dev local (satisfazem validadores Zod):
- `BASEHUB_TOKEN` = `bshb_pk_dev_*` (CMS — substituído por Better Auth em story-002)
- `RESEND_TOKEN` = `re_dev_*`
- `ARCJET_KEY` = `ajkey_dev_*`
- `DATABASE_URL` = `postgresql://localhost:5432/cosmos_dev`
- URLs e emails stub válidos

### 5. Typecheck
```
pnpm --filter @repo/design-system typecheck → EXIT 0
```

### 6. Dev Server
```
pnpm dev (apps/web, porta 3001)
→ ▲ Next.js 16.0.10 (Turbopack)
→ ✓ Ready in 3.6s
→ Local: http://localhost:3001
```

---

## Acceptance Criteria — Verificação

- [x] Workspace pnpm configurado corretamente rodando Next.js em `apps/web`
- [x] `shadcn/ui` instalado (`packages/design-system/components.json` — new-york style)
- [x] Tailwind configurado globalmente com Dark mode (tokens Linear aplicados)
- [x] Light mode tokens definidos no `:root`
- [x] Dev server `pnpm dev` roda sem erros em http://localhost:3001

---

## Pendências / Notas para Próximas Stories

- `BASEHUB_TOKEN` e CMS (Basehub) serão substituídos por solução própria (story-002+)
- Clerk auth stubs serão removidos e Better Auth instalado (story-002)
- `DATABASE_URL` precisa de Postgres local ou Docker para stories com Prisma
- `baseline-browser-mapping` warn → atualizar com `npm i baseline-browser-mapping@latest -D`
- Betterstack/PostHog sem chaves reais → logs redirecionados para console (esperado em dev)
