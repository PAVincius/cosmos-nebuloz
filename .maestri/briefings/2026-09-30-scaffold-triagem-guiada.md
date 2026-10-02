# Briefing — triagem guiada e guia conversacional no Scaffold

Pedido do CEO em 2026-09-30. Camada nova sobre as trilhas; **não entra no PR único da Fundação** (feat/scaffold-trilha-framework).

## O que o CEO quer (fiel)

- As trilhas servem para aplicar as correções que o Meridian aponta, depois de aplicar o "dicionário" (faixas e arquétipos) à empresa.
- Score baixo num eixo (ex.: Dados) abre a parte da trilha daquele eixo, e a **triagem precisa ser detalhada até a ação real**. É um grafo de decisão, e cobrir tudo é complexo — então começar com listas prontas de respostas.
- Exemplo de Dados:
  1. "Qual banco você usa para guardar/usar esses dados?" (lista de bancos conhecidos; cada um já tem a vocação conhecida: relacional, documento, colunar, vetorial, data lake, planilha…)
  2. "Qual a proporção majoritária de tipo de dado nesse banco?" (estruturado, semiestruturado, não estruturado)
  3. Centralizado ou descentralizado?
  - Se o banco escolhido não é o indicado para aquele tipo de dado/uso → **ponto de suporte**: trocar ou complementar com um banco especializado. Isso vira passo/entregável da trilha.
- A trilha fica "muito direta na prática": como resolver o problema de dados, de pessoas, de tecnologia.
- **Guia conversacional por trilha**: um chat que conduz o aplicante pelas etapas e pela triagem, com **modo de voz**. Inspirado no "trabalho do cofundador" (Socio). Teste primeiro, depois produto.
- Voz: endpoint conversacional da OpenAI (Realtime) ou uma alternativa mais barata ao ElevenLabs (o CEO citou um nome que chegou como "Abinit" — a confirmar).

## Proposta de desenho (para o Norte decidir)

- **Grafo de triagem como dado versionado do molde** (junto da versão do template), não código: nós = perguntas com opções fechadas; arestas = regra sobre a resposta; folhas = recomendação que liga a um passo/entregável condicional (mecanismo de dispensa por motivo que a D-24 já usa).
- Entrada do grafo = eixo e faixa do Meridian (e arquétipo). Respostas ficam registradas na trilha do cliente (evidência do "por quê" daquela ação).
- **Guia**: agente que lê o estado da trilha (fase, passos, entregáveis pendentes) e o grafo; faz as perguntas do grafo em linguagem natural e grava a resposta estruturada. Texto primeiro; voz como modo.
- **Piloto**: só o eixo Dados, 2–3 perguntas, 5–8 recomendações.

## Pontos de atenção

- LGPD: voz e transcrição são dado pessoal; gravação de conversa exige base legal, aviso e retenção (parecer do Lacre antes de qualquer teste com pessoa real).
- Custo: API de voz/LLM é gasto recorrente — o CEO decide o provedor com a pesquisa do Radar em mãos.
- Não quebrar o invariante dos gates: resposta de triagem não aprova entregável sozinha.
