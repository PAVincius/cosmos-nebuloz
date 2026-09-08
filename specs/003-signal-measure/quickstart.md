# Quickstart — validar o Signal

Guia de validação executável. Prova, ponta a ponta, que a feature funciona. Detalhes de modelo em [data-model.md](./data-model.md); assinaturas em [contracts/server-actions.md](./contracts/server-actions.md).

## Pré-requisitos

- pnpm 10.24.0, Node 24, Postgres acessível via `DATABASE_URL`
- Tenant de teste com `TenantModule { module: SIGNAL, status: ACTIVE }`
- Usuário do tenant com `SignalMember { role: ADMIN }`

## Setup

```bash
pnpm install
```

```bash
pnpm migrate
```

```bash
pnpm dev
```

App em `http://localhost:3012`. Signal em `/signal`.

## Checagens automáticas

```bash
pnpm --filter app test -- signal
```

```bash
pnpm check && pnpm --filter app typecheck
```

Cobertura do bloco (piso da constituição: 80%):

```bash
pnpm --filter app test:coverage -- signal
```

## Jornada 1 — Do zero ao veredito

Cobre FR-1 a FR-16. Executar em `/signal` como `ADMIN`.

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Abrir `/signal` sem iniciativa | Estado vazio explica que é preciso hipótese + baseline. Sidebar com contadores em zero |
| 2 | Criar iniciativa (nome, BU, categoria `productivity`, dono, hipótese) | Código `IN-01` emitido; status `DRAFT`; trilha registra `signal.initiative` criada |
| 3 | Tentar ativar antes do baseline | Recusado com a regra nomeada `baseline.required` (422), não erro genérico |
| 4 | Capturar baseline com as 5 dimensões e assinar | Versão `v1` com quem assinou e quando; dimensões mostram a fonte declarada |
| 5 | Ativar a iniciativa | Status `ACTIVE`; trilha com `DRAFT → ACTIVE` |
| 6 | Criar conexão e mapear evento → métrica | `CN-01` e `MP-01`; mapeamento `ACTIVE` |
| 7 | Registrar observação pelo mapeamento | `EV-…` com janela, linhas, transformação e origem |
| 8 | Versionar fórmula de ROI com componentes, custos e premissas | Múltiplo calculado; versão `v1`; trilha registra a fórmula |
| 9 | Abrir o detalhe da iniciativa | Adoção e resultado na mesma tela; ROI exibido **junto** da versão da fórmula e do score de confiança; veredito com ação sugerida |

**Falha se**: qualquer tela exibir múltiplo de ROI sem versão de fórmula e confiança ao lado (regra-mãe do produto).

## Jornada 2 — Fonte cai, o número não mente

Cobre FR-9, FR-13, FR-19, FR-23.

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | `recordSync` da conexão com falha de auth | `health = DOWN`; erro traz o conserto e o impacto (quais métricas de quais iniciativas congelaram) |
| 2 | Ver `/signal/mapping` | Mapeamentos da fonte em `BROKEN` |
| 3 | Ver `/signal/evidence` | Observações afetadas com `flag` de congelamento e `frozenAt` |
| 4 | Ver `/signal/alerts` | Alerta `stale` aberto, com o quê, próximo passo e dono |
| 5 | Ver o detalhe da iniciativa | Score de confiança **caiu** pelo fator "fontes sincronizando", com a nota explicando o desconto |
| 6 | Ver o sidebar | Contador de `connections` em vermelho; chip do topbar em pulso vermelho |

**Falha se**: o ROI continuar exibido como se nada tivesse acontecido, ou a confiança não se mover.

## Jornada 3 — Relatório congelado é imutável

Cobre FR-18, TR-4.

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Criar rascunho de relatório executivo do período | `RP-…` em `DRAFT` |
| 2 | Tentar congelar com a conexão ainda `DOWN` | Recusado com 409 e `blockers` listando as fontes — a UI lista, não manda procurar |
| 3 | Restaurar a conexão (`recordSync` ok) e congelar | Estado `FINAL`, `generatedAt` e `payload` estruturado gravados |
| 4 | Alterar a fórmula de ROI da iniciativa citada | Detalhe mostra o novo múltiplo |
| 5 | Reabrir o relatório congelado | Números **idênticos** aos do congelamento |
| 6 | Tentar escrever no relatório `FINAL` | Recusado com `report.frozen` |
| 7 | Exportar | Saída gerada a partir do `payload`, nunca da tela |

## Jornada 4 — Isolamento e papéis (Crítico)

| # | Ação | Resultado esperado |
|---|---|---|
| 1 | Acessar `/signal` sem sessão | Redireciona para `/sign-in` |
| 2 | Acessar com tenant sem o módulo `SIGNAL` | Redireciona para `/signal-indisponivel` |
| 3 | Como `VIEWER`, tentar `createInitiative` **chamando a action direto** | 403 — o guard está na action, não só na UI |
| 4 | Como `OWNER`, editar iniciativa de outra pessoa | 403 |
| 5 | Como `ANALYST`, tentar congelar relatório | 403 (`signal.report.freeze` é de `ADMIN`) |
| 6 | Buscar `IN-…` de outro tenant por código | Não encontrado — nunca "sem permissão", que já vazaria a existência |
| 7 | Trocar a persona no switcher | Ordem/ênfase da leitura muda; **nenhum dado novo aparece** |

## Jornada 5 — Acessibilidade

```bash
pnpm --filter app test:e2e -- signal-a11y
```

| # | Checagem | Esperado |
|---|---|---|
| 1 | Tab a partir do topo | Skip link aparece e pula para o conteúdo |
| 2 | Navegação só por teclado nas 10 telas | Foco sempre visível (2px, `--accent`); nenhuma armadilha |
| 3 | ⌘K | Paleta abre, prende o foco, Esc fecha e devolve o foco ao gatilho |
| 4 | `data-contrast="high"` | Texto e borda reforçados; `.dots`/`.wm`/`.sig` e textura de grade somem; **containers permanecem** |
| 5 | `prefers-reduced-motion` e `data-motion="reduced"` | Animações neutralizadas nos dois caminhos |
| 6 | axe nas 10 telas, nos dois temas | Zero violação |

## Critério de conclusão

- [ ] Jornadas 1–5 passam
- [ ] `pnpm check` verde
- [ ] `pnpm --filter app test:coverage -- signal` ≥ 80%
- [ ] `pnpm build` verde
- [ ] Nenhuma tela viola as 7 regras de conteúdo de [contracts/ui-contract.md](./contracts/ui-contract.md) §6
- [ ] Completion doc em `.claude/completions/2026-09-02-signal-measure.md`
