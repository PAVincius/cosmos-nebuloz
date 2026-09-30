# Triagem guiada e guia conversacional no Scaffold (D-26)

- **Pedido por:** CEO, via Morgana · **Data:** 2026-09-30 · **Autor:** Norte (CPO)
- **Estado:** decisão **provisória** (D-26 em `../registro-de-decisoes.md`).
- **Origem:** briefing da Morgana, `.maestri/briefings/2026-09-30-scaffold-triagem-guiada.md`.
- **Fora do PR único da Fundação.** É entrega separada e começa depois que a Fundação de Prontidão de IA
  estiver na `github/main`. O grafo é dado de uma versão nova do molde da Fundação.

O Meridian aponta o eixo fraco. A trilha tem de dizer o que fazer na prática. A triagem guiada é um grafo
de decisão por eixo, com respostas fechadas, que termina numa ação real da trilha. O guia é a conversa
que conduz o aplicante pela trilha e pela triagem, em texto ou em voz.

## 1. Escopo do piloto

| Item | Decisão |
|---|---|
| Eixo | **Só Dados.** Entra quando o eixo está em Inicial ou Em formação (score < 60) no assessment de origem |
| Perguntas | **Três, com opções fechadas:** (1) qual banco guarda ou serve esses dados, de uma lista de bancos conhecidos em que cada opção já traz a vocação (relacional, documento, colunar, vetorial, data lake, planilha…); (2) proporção majoritária do tipo de dado (estruturado, semiestruturado, não estruturado); (3) centralizado ou descentralizado |
| Recomendações | **5 a 8 folhas.** Exemplo: banco que não combina com o tipo de dado ou com o uso vira "complementar com banco especializado" ou "trocar". Cada folha é um passo ou entregável da trilha |
| "Outro" | Toda pergunta aceita "outro", com texto livre. Resposta "outro" não dispara folha: vai para a consultora decidir, e é daí que o grafo aprende |
| Fora do piloto | Os outros quatro eixos, perguntas encadeadas além de três níveis, recomendação gerada por modelo |

## 2. Onde o grafo mora

- **Dado versionado na versão do molde**, não código. Campo `triageGraphs Json?` em
  `ScaffoldTemplateVersion`, indexado por eixo. É imutável como o resto da versão (ST-01): mudar o grafo
  exige publicar versão nova, e a trilha em curso continua na sua (ST-03).
  - **Nó** = pergunta com opções fechadas. As opções carregam atributos (a vocação do banco, por exemplo),
    e as regras leem esses atributos.
  - **Aresta** = regra sobre a resposta.
  - **Folha** = recomendação, que aponta o `code` de um passo ou entregável **condicional** da mesma
    versão.
- **Validação no publish:** toda folha aponta um código que existe na versão; o grafo não tem ciclo; toda
  opção de todo nó leva a um nó ou a uma folha, sem ponta solta. O publish recusa grafo inválido.
- **A folha usa o mecanismo que a D-24 já tem.** O entregável condicional nasce dispensado com o motivo
  "a triagem não indicou". Quando a triagem indica, ele vira proposta de ativação, e ativar é ato da
  consultora (§3).
- **Respostas por trilha:** tabela nova, append-only, com trilha, eixo, nó, opção, texto de "outro",
  quem respondeu, quando e por onde (formulário ou guia). Responder de novo cria linha nova e a última
  vale. É a evidência do porquê daquela ação.

## 3. O invariante dos gates

- **A triagem não aprova nem dispensa nada sozinha.** Uma resposta produz uma **recomendação**. O
  entregável só passa a obrigatório quando a **consultora (CONSULTANT) ou o líder de transformação**
  confirma, e isso fica registrado. Sem essa regra, quem responde poderia tirar um entregável do caminho
  do gate escolhendo outra opção. É o gate virando formalidade, o risco nº 1 da spec 002.
- Mudar uma resposta depois que o entregável foi ativado não desativa nada. Só sinaliza para a
  consultora revisar.
- Quem responde: quem tem `step.complete` na trilha. É o time que conhece o banco.

## 4. O guia conversacional

**É o escopo Scaffold do copiloto único da D-07, não um chatbot novo.** Um núcleo com ferramentas por
produto; a permissão é a da sessão; escrita passa pela server action do Scaffold (`safeAction`, RBAC,
`logAudit`).

| Pode | Não pode |
|---|---|
| Ler o estado da trilha: fase, passos, entregáveis pendentes, critérios do gate | Aprovar, enviar para revisão, pedir ajuste ou reabrir entregável |
| Ler o grafo e fazer as perguntas em linguagem natural | Fechar gate, fazer override, assinar caso de negócio |
| Gravar a resposta **estruturada**, uma opção da lista, com confirmação na tela antes de gravar, atribuída a quem conversa e marcada "via guia" | Ativar ou dispensar entregável; mexer em overlay ou template |
| Explicar um passo e por que ele existe, citando a origem (condição 5 da D-07) | Inventar opção fora da lista: sem casar com uma opção, grava "outro" com o texto |
| Rascunhar texto que a pessoa copia para um entregável | Ler outro tenant, ou o que a pessoa não veria na tela; enviar qualquer coisa para fora |

**Pré-requisito:** a D-07 registra que o Copilot de hoje, no Cosmos, só confere papel na escrita e lê o
tenant inteiro (condição 2). O guia não sai antes de o núcleo conferir permissão na leitura. Senão o
primeiro escopo novo nasce com a mesma falha.

## 5. Voz

- A voz é um **modo** do guia, não um produto à parte: as mesmas ferramentas e as mesmas regras da §4.
- **Só no tenant interno** (`isInternalTenant = true`) até o parecer do Lacre sobre voz e transcrição,
  que são dado pessoal. Nenhum teste com pessoa real de cliente antes disso.
- **Minimização no piloto:** o áudio não é guardado. A transcrição não é persistida além da resposta
  estruturada gravada. Qualquer retenção maior passa pelo Lacre.
- **Provedor:** o CEO decide com a pesquisa do Radar (OpenAI Realtime ou alternativa mais barata ao
  ElevenLabs; o nome citado no áudio, "Abinit", está a confirmar). É gasto recorrente, e a cota por
  crédito (D-04) vale para ele.

## 6. Ordem

1. **Grafo + formulário, sem modelo.** O grafo de Dados na próxima versão da Fundação, as respostas por
   formulário na trilha, a recomendação e a confirmação da consultora. Isso já entrega a triagem "direta
   na prática" e testa o grafo sem custo de API.
2. **Guia em texto**, escopo Scaffold do copiloto (D-07), depois do pré-requisito de permissão.
3. **Voz**, no tenant interno, depois do parecer do Lacre e da escolha de provedor pelo CEO.

Cada fase é um PR próprio, com os testes junto. Critério de sucesso do piloto (fase 1): a consultora
conduz a triagem de Dados do Atlas (Dados 32) em menos de 10 minutos, e cada entregável ativado mostra a
resposta que o originou.
