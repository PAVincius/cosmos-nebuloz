# Charter — Corpus de segurança em IA generativa, e o veredito que faltava

## 1. Por que este trabalho existe

O checklist de segurança para aplicações com IA generativa — síntese própria da Nebuloz sobre OWASP LLM Top 10 2025, o checklist de governança de IA da OWASP e o cheat sheet de Secure AI Model Ops — é estruturalmente um `CharterRequirementSet`: seções numeradas, item citável, veredito por item, e a instrução explícita de reexecutar a revisão a cada mudança relevante de modelo, RAG ou release.

O Charter ganhou em `feat/charter-conformidade` exatamente a máquina que isso consome: importar exigências, apontar a capacidade que as prova, anexar evidência viva e exportar. **Este é o primeiro uso real do mapa** — e, diferente dos quatro corpora regulatórios, é um ativo comercial: um comprador enterprise que pergunta "como vocês protegem a IA de vocês?" recebe um mapa com evidência, não um PDF de promessas.

## 2. O problema que precisa ser resolvido antes

`CharterCoverageStatus` tem cinco valores: `ATENDE`, `PARCIAL`, `NAO_ATENDE`, `SEM_VEREDITO`, `REVISAR`.

O checklist pede **Pass / Fail / N/A** — e a terceira não existe.

Não é hipótese. A stack da Nebuloz é TypeScript e Next.js: não há backend Python, RAG, base vetorial nem fine-tuning. As seções 3.2 (segurança de RAG e vetores), 3.3 (poisoning e backdoors) e boa parte da 4.2 descrevem controles sobre componentes que o produto não tem — cerca de 25 dos ~70 itens.

Marcá-los `NAO_ATENDE` faria o mapa afirmar, a um comprador, que a Nebuloz **falha** em 25 controles de segurança de IA que sequer se aplicam. É a mentira mais cara possível, porque é auto-infligida num documento comercial, e é exatamente a falha que §6 do spec do mapa nomeia como a única que importa.

Usar `PARCIAL` com comentário mente igual, mais baixo. Omitir os itens do corpus esconde metade do valor de um checklist: o comprador não vê que a pergunta foi considerada e descartada com razão.

**Decisão: o enum ganha `NAO_APLICAVEL`.** Migration nova — a `20260806000000_charter_conformidade` já está aplicada em produção e não se edita.

---

## 3. Escopo

**Dentro.** O valor `NAO_APLICAVEL` no enum e tudo que precisa saber dele; o corpus com ~70 exigências citadas por seção.

**Fora, deliberadamente:**

- **Preencher os vereditos.** O corpus entra vazio (`SEM_VEREDITO`). Quem decide se a Nebuloz atende um controle é uma pessoa, não o seed — é a regra do produto e vale para o próprio produto.
- **Auditar o código contra o checklist.** Trabalho separado, e o mapa é onde o resultado dele mora depois.
- **Um estado `N/A` que dispense justificativa.** Ver §4.3.

---

## 4. Arquitetura

### 4.1 O enum e a migration

```sql
ALTER TYPE "CharterCoverageStatus" ADD VALUE IF NOT EXISTS 'NAO_APLICAVEL';
```

Duas coisas que o implementer precisa saber, porque **não há precedente de `ADD VALUE` neste repositório** — esta é a primeira migration de enum, e não há padrão da casa para copiar.

**A migration contém apenas este comando.** No Postgres 12 em diante, `ADD VALUE` roda dentro de bloco de transação, mas o valor novo **não pode ser usado** até aquela transação committar. O Prisma envolve cada migration numa transação, então uma migration que adiciona o valor *e* o usa — num `DEFAULT`, num `CHECK`, num `UPDATE` — falha. Se algum passo precisar usá-lo, vai numa migration seguinte.

**Não é reversível.** Postgres não tem `DROP VALUE`. Desfazer exige recriar o tipo e reescrever toda coluna que o usa. Vale conferir o nome antes de aplicar, porque a correção depois é cara.

### 4.2 Onde o valor novo precisa aparecer

Adicionar um membro a um enum quebra toda exaustividade que dependa dele. Os pontos a tratar:

| Lugar | O que muda |
|---|---|
| `compliance.tsx` · `STATUS_META` | `Record<MapRow["status"], …>` — o TypeScript vai exigir a entrada. Rótulo "Não se aplica", tom neutro |
| `compliance.tsx` · `STATUS_ORDER` | posição na ordenação: depois de `NAO_ATENDE`, antes de `SEM_VEREDITO` |
| `compliance.ts` · `setCoverage` | `NAO_APLICAVEL` **não** exige capacidade (não há o que provar) |
| `compliance.ts` · `getComplianceMap` | `semVeredito` **não** conta `NAO_APLICAVEL` — é veredito, não ausência dele |
| `compliance-pdf.tsx` · `cabecalho` | idem: o "X de Y sem veredito" não infla com itens descartados |
| `compliance-export.ts` · `nomeArquivo` | o sufixo `-rascunho-X-de-Y` segue a mesma contagem |

O quinto e o sexto são o ponto: se `NAO_APLICAVEL` contasse como sem veredito, um mapa 100% respondido apareceria como rascunho para sempre.

### 4.3 Justificativa é obrigatória

`setCoverage` já recusa `ATENDE` e `PARCIAL` sem capacidade, porque alegação precisa de prova. `NAO_APLICAVEL` tem a exigência simétrica: **recusar sem `comentario`.**

"Não se aplica" sem motivo é indistinguível de "não quis responder", e é o veredito mais fácil de abusar num documento que vai para um comprador. O comentário é o que transforma um descarte em uma decisão auditável — "não há base vetorial neste produto" é uma afirmação que alguém assina.

### 4.4 O corpus

`packages/database/scripts/regulacao-corpora.ts`, como quinto membro de `CORPORA`:

- `nome`: `"Segurança em IA generativa — checklist Nebuloz"`
- `origem: "REGULACAO"`, `editor: "NEBULOZ"`, `jurisdicao: "INT"`, `licenca: "LIVRE"`, `versao: "1"`
- Uma exigência por checkbox. `citacao` é a seção (`§4.1`, `§6`); `codigo` é `SEC-<seção>-<n>`, estável para versionar depois
- `texto` carrega o texto do checkbox com os marcadores de nota (`[1][2]`) removidos — é texto próprio da Nebuloz, então reproduzir é legítimo, diferente do corpus ISO
- `resumo` é a formulação curta do controle, e cita o código OWASP (`LLM01`…`LLM10`) quando a fonte nomeia um
- `categoria` é a área da tabela macro (arquitetura, dados, supply chain, backend, frontend, runtime, monitoramento, governança)

O teste de copyright existente (`licenca-copyright.test.ts`) continua valendo sem mudança: ele só proíbe `texto` em conjunto `REFERENCIA`, e este é `LIVRE`.

---

## 5. Erro

| Situação | Resposta |
|---|---|
| `NAO_APLICAVEL` sem `comentario` | Recusa: "Marcar como não aplicável exige dizer por quê." |
| `NAO_APLICAVEL` com `capabilityId` | Aceita e ignora — apontar capacidade para algo que não se aplica é inofensivo, e recusar seria pedantismo que trava o usuário |
| Migration rodada duas vezes | `ADD VALUE IF NOT EXISTS` é idempotente |
| Cliente Prisma velho | O valor novo não existe no client gerado antes da migration; `prisma generate` é obrigatório no deploy, e já está no `build` de `@repo/database` |

---

## 6. Teste

- `setCoverage` recusa `NAO_APLICAVEL` sem comentário, e aceita com
- `NAO_APLICAVEL` **não** entra na contagem de `semVeredito` — em `getComplianceMap` e em `cabecalho`
- um mapa em que todo item é `ATENDE` ou `NAO_APLICAVEL` **não** gera nome de arquivo com `-rascunho`
- a tela renderiza o rótulo "Não se aplica" e o motivo
- o corpus tem ~70 exigências, `codigo` único, `citacao` e `resumo` não vazios em todas
- o teste de copyright segue verde sem alteração

**Verificação:** `cd apps/app && NODE_ENV=test pnpm run test`, contra o resultado mergeado com a `main`.

---

## 7. Lacunas conhecidas

- **O corpus nasce sem veredito nenhum.** Ele só vira ativo comercial depois que alguém responder os ~70 itens. Este trabalho entrega a pergunta, não a resposta.
- **`origem` não tem valor para "padrão interno".** O enum é `RFP | REGULACAO`, e um checklist derivado de OWASP fica em `REGULACAO` por aproximação. Funciona, mas o dia em que houver um terceiro tipo de origem, isto vira dívida.
- **~25 itens serão `NAO_APLICAVEL` hoje e podem deixar de ser.** Se o produto ganhar RAG, base vetorial ou fine-tuning, esses vereditos ficam errados e nada avisa — o corpus não sabe o que a arquitetura virou. É o mesmo problema que `publishSetVersion` resolve para mudança de texto, e ele não cobre mudança de contexto.
