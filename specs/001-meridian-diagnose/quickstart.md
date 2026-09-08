# Quickstart · Meridian V1

Guia de validação. Prova que o módulo funciona ponta a ponta; detalhes de implementação vivem em `tasks.md`.

## Pré-requisitos

- pnpm 10.24.0, PostgreSQL acessível pela `DATABASE_URL` do `.env.local`.
- Um tenant com o módulo `MERIDIAN` contratado e um usuário com `MeridianRole.CONSULTANT`.
- `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para o teste de evidência (opcional — sem eles, o upload é pulado e o resto do fluxo continua).

## Setup

```bash
pnpm install
pnpm migrate
pnpm --filter @repo/app exec tsx scripts/seed-meridian.ts
```

O seed cria: um template `v3.2` com a bateria dos cinco eixos, quatro assessments nos quatro estados (rascunho, coletando, em revisão, finalizado), respondentes com divergência real no eixo Data, e coortes de benchmark acima e abaixo do limiar.

## Rodar

```bash
pnpm dev
```

App em `http://localhost:3012/meridian`.

## Testes

```bash
pnpm --filter @repo/app test -- meridian
pnpm --filter @repo/app exec playwright test e2e/meridian-diagnose.spec.ts
pnpm check && pnpm --filter @repo/app typecheck
```

## Cenários de validação

### 1 · Carteira e detalhe (US1)
Abra `/meridian`. Espere quatro indicadores no topo e a carteira com os quatro assessments. Filtre por *Coletando* — sobra um. Abra `AS-104`: cinco abas, com *Scoring & Revisão* como aba inicial (o assessment está em revisão).

### 2 · Coleta bloqueada por eixo sem dono (US2, FR-011)
Abra `AS-107` (coletando), aba *Coleta*. Um eixo está sem respondente. Clique em *Fechar coleta*: o sistema recusa nomeando o eixo. Atribua um respondente a esse eixo e repita: agora fecha, declarando as respostas pendentes.

### 3 · Link seguro do respondente (US2, R-03)
O seed imprime um link `/meridian-responder/<token>` no console. Abra em janela anônima: aparece a bateria de um eixo só. Tente trocar o último caractere do token: 404 genérico. Responda tudo e envie: o progresso da coleta sobe no painel da consultora.

### 4 · Determinismo do scoring (US3, SC-002)
```bash
pnpm --filter @repo/app test -- meridian-scoring
```
O teste roda o motor duas vezes sobre o mesmo conjunto e compara score, confidence e spread campo a campo.

### 5 · Override append-only (US3, FR-017/018)
Em `AS-104`, aba *Scoring & Revisão*, o eixo Data está contestado. Abra *Revisar e decidir*:
- rationale com 10 caracteres → recusa explicando o mínimo;
- score igual ao computado → recusa;
- score diferente + rationale de 25 caracteres → registra.
Registre um segundo override no mesmo eixo. O histórico mostra os dois, em ordem, e o computado original continua visível.

### 6 · Ciclo no grafo de gaps (US4, FR-023)
Aba *Gap register*. `G-02` depende de `G-01`. Tente fazer `G-01` depender de `G-02`: recusa nomeando o ciclo.

### 7 · Plano topológico (US4, SC-007)
Aba *Plano 12 meses*. Nenhum item aparece em trimestre anterior ao de um pré-requisito. Confirme pelo export:
```bash
pnpm --filter @repo/app test -- meridian-plan
```

### 8 · Benchmark retido (US5/US6, FR-033)
Aba *Relatório & Benchmark* de `AS-104` (setor saúde, coorte acima do mínimo): bandas de percentil desenhadas. Abra o relatório de um assessment do setor agro (coorte com n = 3): a comparação aparece declarada como retida, sem nenhum percentil. Confirme que a resposta da action também não traz os percentis — o corte é na leitura, não na renderização.

### 9 · Diff de reavaliação (US5, FR-035)
`AS-104` é reavaliação de `AS-092`. Em *Entrega ao sponsor*, clique em *Diff vs. run anterior*: variação por eixo, resolvidos, persistentes e saldo do plano. Repita em `AS-096` (não é reavaliação): o sistema explica que não há run anterior.

### 10 · Trilha de auditoria (FR-037, SC-008)
Após os cenários acima, consulte o `AuditLog` filtrando `entityType` por prefixo `meridian.`. Espere entradas de: criação de assessment, atribuição de respondente, fechamento de coleta, scoring, contestação, override (com antes e depois), criação e transição de gap, e cada pedido de URL de evidência.

## Como saber que terminou

- Os dez cenários passam.
- `pnpm check`, `pnpm --filter @repo/app test` e `typecheck` limpos.
- Cobertura do módulo ≥ 80%.
- Nenhuma query do Meridian sem `tenantId` — exceto as duas tabelas de benchmark, que são globais e anônimas por contrato.
