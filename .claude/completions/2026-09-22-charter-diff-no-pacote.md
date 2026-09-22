# Charter — o diff real chega ao pacote de evidência (onda 8)

**Data:** 2026-09-22 · **Branch:** `fix/charter-diff-no-pacote`

Origem: P0 restante da crítica de design do Charter. A PR #236 fez o
`DiffModal` mostrar diff por seção na tela. O artefato que sai do produto
continuava com contagem.

## O que o auditor recebia

`publishPolicyVersion` gravava no evento de auditoria um `AuditDiff` que era
contagem:

```
["Seções alteradas", "—", String(policy.sections.length)]
```

`toCsv` serializava como `` `${f}: ${b} → ${a}` ``, então a célula dizia
**"Seções alteradas: — → 9"**. Pior que incompleto: `policy.sections.length` é
o **total** de seções, sob um rótulo que prometia as **alteradas** — falso
mesmo como contagem. E a tela vendia, em `PACKAGE_CONTENT`, "cada versão com
diff campo a campo e aprovador".

## Derivado do snapshot, não gravado no evento

Cada `CharterPolicyVersion` já guarda `snapshot` — imutável, o registro da
versão publicada. Gravar o texto completo das seções também dentro do `diff`
do evento guardaria o mesmo conteúdo uma **terceira** vez no banco (seção,
snapshot, evento), e três cópias divergem. Então `exportEvidence` deriva:
busca a versão e a anterior e monta o diff na exportação.

A montagem "snapshot × snapshot → linhas por seção" saiu de dentro de
`getVersionDiff` para `lib/charter/version-diff.ts` (`diffDeSnapshots`,
`snapshotSections`, `diffSecoesParaTexto`), reusando `lib/charter/diff.ts`. A
tela e o export chamam a **mesma** função — num pacote de evidência, o CSV
discordar da tela que a compliance lead abriu é o pior defeito possível. O
contrato da tela não mudou: `version-diff.test.ts` e `diff-modal.test.tsx`
seguem verdes sem alteração.

## Como a linha de publicação é reconhecida

O evento aponta para a **política** (`entityId`), não para a versão. A versão
sai do próprio diff do evento (o par rotulado `FIELD_LABELS.version`), e
`@@unique([policyId, version])` fecha a identificação. `ACAO_PUBLICOU_VERSAO`
foi para `audit.constants.ts` porque agora tem dois leitores — quem grava
(`policy.ts`) e quem reconhece (`audit.ts`); duas literais soltas divergiriam
em silêncio e o pacote voltaria a sair sem diff.

Uma query a mais por exportação (`charterPolicyVersion.findMany`), só quando
há publicação no período, sempre com `tenantId`.

## Formatos

- **JSON** — `ExportRow` = `AuditRow` + `sections?: VersionDiffRow[]`, os
  segmentos como o util devolve. `AuditRow` ficou intocado: é o contrato da
  tela de auditoria.
- **CSV** — a coluna `diff` vira célula multilinha: os campos do evento
  (`Campo: antes → depois`, separados por ` | `) e, abaixo, um bloco por seção
  com o nome como cabeçalho e `-`/`+` por linha. `esc` já envolvia toda célula
  em aspas e dobrava as internas, então quebra de linha deixa de ser
  separador (RFC 4180) e o Excel abre certo. Há teste com parser RFC 4180
  provando o round-trip.
- Evento que **não** é publicação sai byte a byte como saía.

## Sem truncagem silenciosa

Nenhum teto novo. O único é o do `diffTexto` (2000 linhas) e, quando vale, o
texto exportado carrega `(N linhas omitidas: texto longo demais para comparar
inteiro)`. Linha `igual` não entra no bloco — é o que um diff é, não conteúdo
cortado.

## Volume

Medido com os corpos de seção reais do seed (9 seções, 1.906 B de texto,
snapshot JSON 2.475 B). A célula `diff` de uma publicação:

| Caso | Antes | Depois |
|---|---|---|
| 1 seção alterada | 54 B | 596 B |
| 2 seções alteradas | 54 B | 1.092 B |
| primeira publicação (9 novas) | 54 B | 2.274 B |

Pior caso ~2,2 KB por publicação. Um trimestre com 4 publicações soma ~9 KB
ao pacote. Não justifica otimização.

## Reprodutibilidade (NFR-5.3)

`snapshot` é imutável, a ordenação das versões é `[publishedAt asc, id asc]`,
`policyIds` vai ordenado e `diffDeSnapshots` é puro — nada depende do relógio
além do filtro. Publicar uma versão nova depois não muda o antecessor de
nenhuma versão anterior. Teste: mesmo filtro chamado duas vezes → strings
idênticas, nos dois formatos.

## A promessa

`PACKAGE_CONTENT` passou a ser verdade **inteira**, sem mudar a copy:

- "diff campo a campo" — era a metade falsa; agora o pacote leva o texto.
- "e aprovador" — já estava. Quem publica é quem aprova: `publishPolicyVersion`
  grava o mesmo `userId` em `approverId` da política, `publishedById` da versão
  e no ator do evento. Na planilha é a coluna `ator` da linha cuja `acao` é
  "Publicou versão" — verificado por teste, não por afirmação.

O comentário acima de `PACKAGE_CONTENT` agora aponta para os testes que a
sustentam: se caírem, é a copy que muda.

## Verificação

`vitest run` suíte inteira 4.284 passando / 0 falhas · `tsc --noEmit` limpo ·
`pnpm size:guard` verde sem `--update` · build "Compiled successfully" (falha
posterior em "Collecting page data" de rota `api/cron` é pré-existente e fora
do diff).

## O que ficou de fora

- **Seção removida não vira linha.** Nenhuma action do app faz `create` ou
  `delete` de `charterPolicySection` — o conjunto é fixo no onboarding/seed,
  então snapshot com seção a menos não é estado alcançável. Há teste
  documentando, para a lacuna aparecer ali se o produto passar a permitir.
- **O seed dá o mesmo snapshot a todas as versões**, então sobre dados de seed
  o diff de seções sai vazio — no pacote e também no `DiffModal`, desde a
  #236. É limitação do seed, não do diff; para ver a célula multilinha,
  publique uma versão no app depois de editar uma seção.
- O texto continua saindo só como diff (`-`/`+`), sem o corpo integral das
  seções inalteradas. É o que "diff campo a campo" promete; incluir tudo
  multiplicaria o pacote sem responder pergunta nova.
