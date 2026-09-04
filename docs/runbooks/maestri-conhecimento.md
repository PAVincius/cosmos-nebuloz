# Runbook: fundação de conhecimento no Maestri

Os arquivos em `.maestri/knowledge/` são a fonte de verdade e são versionados.
As notes no canvas são geradas a partir deles. **Nunca o contrário.**

Tudo abaixo roda de um terminal com Modo Maestro ligado, na raiz do repositório.

## 1. Primeira vez — criar as notes

Antes da primeira execução, rode `maestri note --help` num terminal Maestro e use a forma que ele aceitar — as duas abaixo cobrem os dois formatos possíveis.

Uma note por produto, mais a do Maestro. Se `maestri note create` receber
conteúdo por `--file`:

```bash
for p in meridian charter scaffold cosmos plataforma signal; do
  maestri note create "$p" --file ".maestri/knowledge/$p/note.md"
done
maestri note create "maestro" --file ".maestri/knowledge/maestro/mapa.md"
```

Se receber por argumento:

```bash
for p in meridian charter scaffold cosmos plataforma signal; do
  maestri note create "$p" "$(cat ".maestri/knowledge/$p/note.md")"
done
maestri note create "maestro" "$(cat .maestri/knowledge/maestro/mapa.md)"
```

Escreva Estado de tarefa e Obstáculos no arquivo `.maestri/knowledge/<produto>/note.md`, não na note do canvas — a rotina empurra o arquivo para a note, e o que for escrito só no canvas é sobrescrito no próximo refresh.

## 2. Floor e terminal da rotina

A rotina precisa de um terminal próprio, para não disputar com o trabalho
ativo de um especialista — e precisa rodar **no checkout do chão**, porque é
lá que `.maestri/knowledge/` é versionado.

```bash
maestri floor create "conhecimento" --no-git
maestri recruit "conhecimento" --floor "conhecimento" --preset "Shell" \
  --dir "$(git rev-parse --show-toplevel)"
```

O `--dir` é o que garante que o terminal roda na raiz do repositório mesmo
se o floor `--no-git` não compartilhar o checkout. Conferir com
`maestri list` que o terminal `conhecimento` aparece antes de criar a rotina.

## 3. A rotina

**Não crie a rotina antes de decidir o versionamento dos `graph.json`.** Cada refresh regenera ~24 MB de recortes mais o grafo mestre de ~36 MB; a spec §3.3 manda versionar tudo, e essa decisão está sendo revista (candidato: ignorar só os `graph.json`, versionar os `.md`). Ligar a rotina antes torna o custo de histórico irreversível.

```bash
maestri routine create "refresh-conhecimento" \
  --daily 06:00 \
  --terminal "conhecimento" \
  --command "graphify update . && pnpm knowledge:refresh && for p in meridian charter scaffold cosmos plataforma signal; do maestri note write \"\$p\" --file \".maestri/knowledge/\$p/note.md\"; done && maestri note write maestro --file .maestri/knowledge/maestro/mapa.md"
```

Ajustar `--file` para a forma confirmada no passo 1. Testar uma vez, sem
esperar o horário:

```bash
maestri routine run "refresh-conhecimento"
```

## 4. O que a rotina respeita

- `graphify update` sem `--force`: se o rebuild vier com menos nós, o
  graphify recusa, o exportador roda com o mestre anterior, e o
  `refresh-<data>.md` registra a contagem.
- As seções `## Estado de tarefa` e `## Obstáculos` de cada note sobrevivem
  ao `note write`, porque o exportador as lê do `.maestri/knowledge/<produto>/note.md`
  atual (o arquivo do repositório, não a note do canvas) e as reinjeta no
  `note.md` gerado antes do `note write` empurrar o resultado para o canvas.
- Um `refresh-<data>.md` por dia em `.maestri/knowledge/`; o de ontem não é
  sobrescrito.
- Se um especialista escrever muito nas suas duas seções, a note pode passar de 60 linhas; o refresh não corta — avisa no `refresh-<data>.md` com "passaram do teto".

## 5. Quando algo dá errado

| Sintoma | Causa provável | Ação |
|---|---|---|
| Produto com menos de 20 nós no relatório | prefixo errado em `scripts/knowledge/produtos.mts` | corrigir a tabela, rodar `pnpm test:knowledge`, refresh |
| `nao-roteados.md` crescendo | completion nova sem palavra-chave | acrescentar termo em `PALAVRAS_CHAVE` ou aceitar como compartilhado |
| note perdeu o "Estado de tarefa" | alguém apagou a seção à mão | a rotina recria vazia e avisa no `refresh-<data>.md` |
| `graphify` recusa o rebuild | rebuild com menos nós | não forçar; investigar o que sumiu do código |
