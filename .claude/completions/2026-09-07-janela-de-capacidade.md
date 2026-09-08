# Janela de capacidade — formulário de adicionar capacidade

**Data:** 2026-09-07 · **Commit:** `31c7c3d7` · **Branch:** `claude/telas-empresa-modelo`

Pedido: atualizar o formulário de adicionar capacidade, "hoje bem rudimentar",
tendo como referência o modal `AddCapacityModal` do projeto de design
`691f7fe5-e623-458e-aa9f-92b8c46dbbd9` (`backoffice-capacity.jsx`).

## O que entrou

`StaffPerson` ganha `entraEm`, `saiEm`, `observacao` — nullable, sem backfill
(`20260912000000_janela_de_capacidade`). O formulário ganha dois cards de tipo
(Pessoa / Terceiro), campos de janela e observação, e uma faixa de resumo com as
horas cobertas. A alocação passa a ser recusada quando escapa da janela da
pessoa. `lib/capacidade/janela.ts` concentra a aritmética e as mensagens; o
formulário saiu de `Capacidade` para `FormularioDeCapacidade`.

## Decisões que divergem do design de referência

O usuário decidiu, antes da implementação: **código manda, design é norte
visual**; escopo **Pessoa + Terceiro**, sem tabela de papel/hora e sem nó de
compute.

| Referência | O que foi feito | Por quê |
|---|---|---|
| PAPEL + "Tabela: R$ 580/h · custo R$ 165/h" | Fora | Não existe tabela de papel/hora no back-office, e `platform-ops.prisma` documenta "capacidade é POR PESSOA, não por papel" |
| Rodapé em R$ ("vendável na janela") | Horas na janela | Sem tabela, o número em reais seria inventado |
| Nó de compute / teto do LAB | Fora | LAB não existe no back-office: nem modelo, nem tela, nem fila. Seria subprojeto próprio |
| Semanas S32–S37 | Datas ISO | A tela real trabalha em datas |
| Sem e-mail nem habilidades | Mantidos | E-mail é a chave única que impede a mesma pessoa virar duas linhas com a ocupação dividida |
| Modal | Formulário inline no card | Não existe shell de modal no back-office nem no kit; construir um seria mais código que o formulário |

## Ponytail

**Cortado:** tabela de papel/hora, nó de compute, coluna `terceiro` (derivada de
`saiEm`), shell de modal, backfill da migration, `EntradaDeData` (o formulário de
alocação ao lado já usa `<input type="date">` — seguir o vizinho).

**Questionado e mantido por decisão explícita do usuário**, depois de eu
apresentar as ressalvas:

- **Cards de tipo.** A versão mais preguiçosa era um formulário só com "Sai em
  (opcional)": some um `useState` e um conceito, faz o mesmo. Mantido porque
  nomear "Terceiro" ensina que a tela modela capacidade temporária.
- **Trava de alocação fora da janela.** Adição minha, não pedida. O argumento
  que usei ("janela que ninguém checa é decoração") é fraco — a janela já é
  consumida pelo humano que lê "sai em 12/09" na linha. Mantida porque alocar
  alguém depois do fim do contrato é o erro concreto que ela pega.
- **Faixa de resumo.** Sem R$, mostra `horas/semana × semanas` — multiplicação
  que o operador faz de cabeça.
- **`entraEm`.** A mais fraca das três colunas: `criadoEm` já existe, e `entraEm`
  só serve para quem entra no futuro. Ganhou uso ao virar limite inferior da
  trava de alocação.

**Teto marcado no código:** um CLT que pediu demissão também recebe `saiEm` e
aparece com o badge de terceiro. Vira coluna se a distinção passar a importar.

## Verificação

- `vitest run` no back-office: 71 arquivos, 801 testes (18 novos em
  `capacidade-janela.test.ts`)
- `tsc --noEmit`: limpo
- `biome check`: limpo — três violações de complexidade que eu mesmo introduzi
  foram resolvidas extraindo `erroDaJanela`, `erroDaAlocacao` e
  `FormularioDeCapacidade`
- Migration aplicada no banco local e as três colunas conferidas por
  `information_schema` (nomes batem com o que o client Prisma gera)
- Render local barrado pelo login do back-office. A classe de erro que derrubou
  `/empresa/financeiro` (função cruzando para client component) está ausente por
  construção: `listCapacity` converte `Date` para ISO na fronteira e `page.tsx`
  só passa primitivos.

## Pendente

Verificar em produção depois do push: `/capacidade` com uma pessoa nova e um
terceiro, e a recusa de alocação fora da janela.
