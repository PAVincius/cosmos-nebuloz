# Meridian — P2s do Vigia + condições de compliance + tasks.md spec 006

**Data**: 2026-09-28
**Tarefa**: Morgana (2026-09-27, restart pós setup-canvas)
**Checklist**: `.maestri/knowledge/meridian/note.md` § Estado de tarefa

## Commits (branch main, checkout `.maestri/roles/3180d75e-cf17-4b41-8e4b-94f8fdae1203`)

1. `89937f1b` fix(meridian): TTL próprio em assignRespondent, não copia deadline direto — atrito.md:42
2. `9468abd9` feat(meridian): rate limit no lookup de token + cache do ensureBucket — atrito.md:48/54, parecer cond. 5
3. `1d514a01` feat(meridian): eliminação DSAR apaga o objeto de evidência no bucket — parecer cond. 2
4. `9f33e7ed` docs(meridian): opções de retenção do bucket, tasks.md spec 006, checklist

## Evidência de teste

- `npx vitest run __tests__/meridian` → 144/144 verde
- `npx vitest run __tests__/lib __tests__/meridian` → 436/436 verde
- `npx tsc --noEmit -p .` (apps/app) → limpo
- `npx biome check --write` nos arquivos tocados (sem achado novo; erro do Biome em `apps/backoffice/__tests__/propostas-linha-a11y.test.tsx` é pré-existente, não relacionado)

## Pendente (fora do meu alcance nesta sessão)

- **atrito.md:60 (lifecycle do bucket)**: três opções de retenção documentadas em `atrito.md` (90d / 180d / sem expiração automática) — decisão de prazo é do CEO, não decidi.
- **specs/006 T015/T016**: E2E (`meridian-reemitir-link.spec.ts`, `meridian-reemitir-lote.spec.ts`) não roda neste checkout — `globalSetup` não autentica (`error-context.md` mostra a tela de login em vez da carteira). Lógica (T001-T014) está coberta e verde via testes unitários; UI/E2E ficam pendentes até o ambiente de E2E ser destravado. Registrado em `note.md` § Obstáculos.

## Fora de escopo, não tocado

Diffs de outros agentes no mesmo tree (charter/provisioning/switch-tenant) — não commitados, como pedido pela Morgana.
