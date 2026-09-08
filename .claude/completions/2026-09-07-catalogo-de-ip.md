# Catálogo de IP — procedência, licença e reuso medido

**Data:** 2026-09-07 · **Branch:** `claude/telas-empresa-modelo` · **Commits:** `15ba7afe..88e44580`
**Spec:** [`2026-09-07-catalogo-de-ip-design.md`](../../docs/superpowers/specs/2026-09-07-catalogo-de-ip-design.md) ·
**Plano:** [`2026-09-07-catalogo-de-ip.md`](../../docs/superpowers/plans/2026-09-07-catalogo-de-ip.md)

Executado com subagent-driven: seis tarefas, uma revisão por tarefa, revisão final da branch
inteira e uma onda de correção.

## O que entrou

`IpAsset` ganhou `link` (nulo significa que o ativo vive no editor daqui), `donoPersonId`,
`procedencia`, `reusoConfirmado`, `licenca` e `licencaRef`. Duas tabelas novas:
`IpAssetService` (que serviços o ativo encurta) e `IpAssetReuse` (o reuso como fato, com
`@@unique([assetId, engagementId])`).

`lib/ip/regua.ts` concentra a régua de seis critérios e a maturidade derivada. A tela espelha
essa mesma função; a autoridade é a action, porque um POST direto não passa por tela nenhuma.

`registrarReusoAction` é a única porta por onde reuso muda. Reusos, horas poupadas e
maturidade saem de lá — nenhum dos três é campo digitado em lugar algum.

Fora do catálogo, a mesma branch trouxe a janela de contrato na capacidade (`entraEm`,
`saiEm`, `observacao`, com alocação fora da janela recusada) e a troca da barra lateral de
260-280px pelo `SeletorDeAcervo`, que fica acima do conteúdo e colapsa ao selecionar.

## Ponytail

**Cortado, e por quê:**

- **Tabela de papel/hora e KPI de margem em reais.** O design de referência multiplica horas
  por um custo blended de R$ 190 que não existe no back-office. Número em reais sem fonte é
  inventado, e rodapé inventado é pior que rodapé nenhum. Ficaram as horas.
- **Nó de compute / teto do LAB.** O LAB não existe nesta base: nem modelo, nem tela, nem
  fila. Seria subprojeto próprio, não um formulário.
- **Maturidade `EM_ENDURECIMENTO` e `APOSENTADO`.** O design tinha quatro estados; só dois são
  deriváveis da contagem de reuso. Os outros seriam rótulo digitado dentro de uma dimensão que
  a decisão de medir reuso tornou derivada.
- **Coluna booleana "vive aqui".** O nulo de `link` já é essa informação.
- **Coluna de maturidade.** Derivada de `count(reusos)`.
- **`horasPoupadas` no ativo.** Fica no evento. Uma média no ativo multiplicada pela contagem
  seria segunda fonte para o mesmo número.
- **Shell de modal.** Não existe um no back-office nem no kit; construir um seria mais código
  que o formulário inteiro. O padrão da casa é bloco expansível na própria tela.
- **`useEmpilhado`/`matchMedia` no layout novo.** Empilhado virou o único estado, então o
  listener que alternava entre uma e duas colunas deixou de ser necessário — uma linha a
  menos, não uma a mais.
- **Painel "onde o reuso está pagando".** Mesmo dado do KPI de horas, agrupado por serviço.
  Cabe depois, quando houver reuso registrado para agrupar.

**Mantido apesar de custar:** a tabela `IpAssetReuse`. É a única estrutura nova que a régua de
aceitação não pedia. Sem ela, três números da tela voltam a ser digitados — foi escolha
explícita do usuário quando apresentei a alternativa.

**Tetos marcados no código:** um CLT que pediu demissão também recebe `saiEm` e aparece com o
badge de terceiro (`lib/capacidade/janela.ts`). Vira coluna se a distinção passar a importar.

**Adiado com motivo, não esquecido:** extrair `Chip`, `Marcador` e `CampoDeGrupo` de
`registrar.tsx` para `components/campo.tsx`. São primitivas de formulário genéricas presas
numa tela, e `CampoDeGrupo` resolve o `fieldset`/`legend` para grupo de controles que a
próxima tela vai reencontrar e provavelmente resolver errado. A revisão final recomendou; não
bloqueia o merge.

## O defeito característico desta série

Cinco vezes o mesmo erro, cinco vezes corrigido: um `6` literal ao lado de uma lista derivada;
um `40` redeclarado no cliente; uma lista de licenças copiada num módulo novo — pela mesma
rodada que estava eliminando o `40`; um badge de maturidade escrito à mão; e, achado só pela
revisão final, os mínimos da régua redigitados no zod.

O quinto era o pior porque estava do lado da autoridade: o zod roda antes da régua, então um
mínimo menor no zod faria `avaliarRegua` nunca ser consultada. Segunda autoridade invisível
sobre a regra que o spec declara única. A prova de que já tinha divergido está no histórico —
um commit trocou `.min(2)` por `.min(3)` à mão, alguém transcrevendo a constante.

Regra que ficou: **o zod cuida de forma e teto; a régua cuida de todo mínimo.**

## Dois defeitos reais que as revisões pegaram

**Campo condicional vazando no payload.** Escolher procedência "engajamento", marcar a
cláusula de reuso e depois voltar para "investimento interno" gravava as duas coisas: o ativo
ficava como investimento interno *e* com origem num engajamento pago — a contradição de
procedência que a feature existe para impedir. Corrigido com uma função pura que monta o
payload a partir do estado visível, testada por oito casos.

**Estado vazando entre itens da lista.** O slot da linha recolhida não tinha `key` amarrada ao
id. Uma revisão concluiu, por leitura de branches, que não havia vazamento observável; o teste
provou o contrário, e a re-revisão achou o caminho real: criar um ativo com outro já aberto
troca o id dentro do mesmo galho recolhido, sem desmontar nada. Como esse slot hospeda o bloco
de registrar reuso, o vazamento significaria confirmar num ativo o que foi digitado para
outro.

Fica o lembrete: análise de branch não substitui um teste que tenta quebrar a coisa.

## Verificação

Rodada por mim depois da onda final, não relatada por subagente:

- `apps/backoffice`: `tsc --noEmit` sem saída; 74 arquivos, 859 testes
- `apps/app`: 392 arquivos, 4052 testes (20 skips pré-existentes) — inclui o guard
  `tenant-unique-keys`, que era o risco real de ter mexido no schema
- `packages/database`: 3 arquivos, 23 testes
- Migration conferida contra o schema coluna a coluna, e aplicada no banco local
- O comentário corrigido do campo `tipo` conferido nos artefatos gerados do Prisma, que são
  gitignorados e por isso não aparecem no diff

## Pendente

**Verificação em produção, depois do push.** Em `/ip`: registrar um ativo com procedência de
engajamento sem marcar a cláusula (deve recusar); registrar o mesmo reuso duas vezes (deve
recusar com a frase inteira, não com erro do Prisma); conferir que o segundo reuso promove o
ativo a comprovado. Em `/capacidade`: cadastrar um terceiro com janela e tentar alocá-lo para
depois da data de saída.

**Não bloqueiam o merge, registrados pela revisão final:** os tetos do zod emitem mensagem em
inglês quando estourados; a linha de pessoa nova é montada no cliente em `capacidade.tsx` (o
mesmo padrão que foi corrigido do lado do IP, não aplicado do lado da capacidade — herdado,
não introduzido aqui); um `useId` órfão em `biblioteca.tsx`; RASCUNHO pintado de âmbar na
prévia e neutro na linha; e serviço inativo pode fechar a IP-R4 sem contar na lacuna.
