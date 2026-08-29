# Meridian V1 · Diagnose — implementação

**Data**: 2026-08-28
**Branch**: `claude/meridian-design-impl-70bdd2`
**Spec**: [specs/001-meridian-diagnose/](../../specs/001-meridian-diagnose/)
**Origem**: handoff `meridian.html` + `meridian-*.jsx` + `nebuloz-seams.jsx` (Claude Design, projeto `cards`)

---

## O que entrou

Quarto módulo contratável da suíte, ao lado de Cosmos, Charter e Signal:
diagnóstico de prontidão para IA em cinco eixos, com coleta multi-respondente,
scoring determinístico, revisão humana auditável, registro canônico de gaps,
plano de 12 meses e benchmark anônimo por coorte.

### Dados

`packages/database/prisma/schema/meridian.prisma` — 14 modelos, 11 enums.
`ProductModule` ganhou `MERIDIAN`; `Tenant` ganhou as relações inversas.

Três decisões do modelo que valem ser lembradas:

- **`MeridianAxisScore.computed` é write-once.** Toda mudança de número visível
  passa por `MeridianOverride`, que é append-only por construção — sem
  `updatedAt`, sem caminho de delete no código. É essa tabela que responde "por
  que o número mudou?".
- **`MeridianTemplate.lockedAt`** congela a versão no primeiro uso. Mudar um
  peso depois reescreveria em silêncio um diagnóstico já entregue.
- **As duas tabelas de benchmark não têm `tenantId`** — são globais e anônimas
  por contrato, e é exatamente por isso que nenhuma coluna delas identifica
  organização.

### Domínio (funções puras, testadas primeiro)

| Arquivo | Responsabilidade |
|---|---|
| `lib/meridian/scoring.ts` | score 0–100 e confiança 0–1 por eixo. Sem relógio, sem aleatório, iterando pela ordem canônica — determinismo é requisito, não estilo |
| `lib/meridian/graph.ts` | DFS tri-estado para ciclo (nomeando o ciclo) e Kahn com desempate explícito |
| `lib/meridian/plan.ts` | ordenação topológica → quatro trimestres |
| `lib/meridian/benchmark.ts` | coorte, percentis por interpolação, e o único ponto onde o limiar de leitura é aplicado |
| `lib/meridian/respondent-token.ts` | token de 32 bytes, persistido só como hash |
| `lib/meridian/guards.ts` | sessão → módulo → papel, nessa ordem |

### Superfície

`app/(meridian)/` com layout guardado, rota única `/meridian/[[...seg]]` e
registry de telas — mesmo padrão do Charter. Nove telas portadas: carteira,
detalhe com cinco abas, fila de revisão, benchmark pool, gap register, escala de
confiança e visão do respondente.

A visão do respondente é a única rota fora do guard: vive em
`app/meridian-responder/[token]`, **fora** do route group. O layout de um group
envolve tudo sob ele, então bastaria estar lá dentro para o guard disparar
contra alguém que, por definição, não tem conta — o build foi o que revelou o
erro, com a rota saindo guardada. Pelo mesmo motivo a URL não começa com
`/meridian`, que virou prefixo protegido no proxy. O tenant sai do token, nunca
do request.

### Reuso

Nada de kit duplicado. Três camadas: `@repo/design-system/cosmos/kit` para as
primitivas compartilhadas, `components/charter/base` reexportado por
`components/meridian/base.tsx` (ponto único e documentado de acoplamento), e
`components/meridian/` só para o que não existia — `ScoreRing`, `Radar`,
`BenchBand`, `ConfPill`, `InheritedFrom`, `AwaitingUpstream`.

`meridian.css` é cópia reescopada de `charter.css`, pelo mesmo motivo que aquele
arquivo é cópia reescopada do `cosmos.css`: as primitivas dependem de nomes de
classe escopados por raiz. Marcar a raiz do Meridian como `charter-root`
resolveria o CSS e mentiria no DOM.

---

## Testes

96 testes em 9 arquivos de action/guard, mais 30 nos módulos de domínio e 8 de
tela. Todos escritos antes da implementação correspondente.

O que eles travam, e não apenas exercitam:

- scoring determinístico — duas execuções sobre a mesma entrada são idênticas;
- `computed` nunca é reescrito, nem numa segunda passada do scoring;
- rationale < 20 caracteres e override sem mudança de score são recusados;
- ciclo no DAG é recusado na escrita, com os códigos do ciclo na mensagem;
- nenhum item do plano precede um pré-requisito, sobre grafos gerados;
- coorte abaixo do mínimo sai da action **sem** os percentis — o corte é na
  leitura, não na renderização;
- token inexistente, expirado e revogado devolvem exatamente o mesmo erro;
- a trilha do acesso à evidência é gravada **antes** de a URL assinada sair.

E2E em `e2e/meridian-diagnose.spec.ts`, cobrindo os cenários de `quickstart.md`.

---

## Alterações fora do módulo

| Arquivo | Mudança | Por quê |
|---|---|---|
| `packages/design-system/cosmos/kit.tsx` | `Button` ganhou `disabled` e `type` | Atributo real em vez de opacidade; o CSS já cobria `.btn:disabled` |
| `packages/design-system/cosmos/icons.tsx` | +`crosshair`, +`diff`, +`outbound` | Glifos que o handoff usa e o set não tinha. Adição pura |
| `packages/storage/src/index.ts` | `ensureBucket(bucket?)` + `MERIDIAN_EVIDENCE_BUCKET` | Era fixo no bucket do playground |
| `packages/rbac/src/` | `meridian-matrix.ts`, `meridian-resolve.ts` | Papéis próprios, como o Charter |
| `packages/auth/proxy.ts` | `/meridian` em `PROTECTED_PREFIXES` | Redirect antes do RSC para quem não tem sessão, como Cosmos e Charter |
| `app/actions/produtos/index.ts`, `app/(authenticated)/produto/page.tsx` | entrada MERIDIAN | `Record<ProductModule, …>` passou a exigir a chave nova |
| `biome.jsonc` | `(meridian)/actions/**` e `components/meridian/**` nos overrides existentes | Mesmas exceções do Charter, pelos mesmos motivos |
| `system.prisma` | comentário de `actorType` | Agora inclui `respondent` |

---

## Seed

```bash
pnpm --filter @repo/app seed:meridian
```

Cria template v3.2, quatro assessments (um em cada estado, incluindo uma
reavaliação), respondentes com divergência real no eixo Data, gaps com DAG,
plano sequenciado, um override justificado e três coortes — uma delas retida.

Os scores **não** são copiados do protótipo: saem de `computeAxisScore()` sobre
as respostas semeadas. Copiá-los produziria um banco onde o número da tela não
corresponde às respostas, que é o bug que o determinismo existe para impedir.

O script imprime os links de respondente no fim — é por eles que se abre a
bateria sem conta.

---

## O que ficou de fora, e por quê

- **Geração de PDF do relatório.** A tela entrega shape, benchmark, narrativa e
  diff; o documento em si reusa o mecanismo de export existente e foi tratado
  como incremento, conforme as Assumptions do spec.
- **Promoção para Scaffold e Signal.** Os dois produtos não existem no
  repositório. A promoção é registrada com `targetEntityId` nulo — vínculo
  declarado como pendente é melhor do que um stub que finge que o trabalho
  existe.
- **Envio real de convite e lembrete.** As actions registram o estado e o
  horário; o disparo de e-mail entra quando o canal de notificação do módulo for
  ligado.
- **Verificação no navegador.** Depende de `prisma db push` e do seed contra o
  banco de desenvolvimento compartilhado — uma escrita que não cabe decidir
  sozinho. `next build` compilou as três rotas do módulo, e typecheck, lint e
  154 testes passam; a verificação visual fica para quem rodar o seed.

---

## Comandos de conferência

```bash
pnpm --filter @repo/app test -- meridian
pnpm --filter @repo/app typecheck
pnpm check
```
