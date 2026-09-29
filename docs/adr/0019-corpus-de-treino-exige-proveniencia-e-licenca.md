# ADR-0019 — Nenhum treino de modelo próprio sobre saída de modelo de API sem autorização escrita; proveniência por item no LAB

**Status**: Proposed
**Data**: 2026-09-29
**Contexto de origem**: pre-mortem do Sócio sobre a pesquisa de validação do registro de decisões (`docs/socio/2026-09-28-validacao-decisoes.md`, Causa 2 e §2.1), a pedido do CEO

## Contexto

O registro de decisões (`docs/produto/registro-de-decisoes.md`, D-09 e D-11)
propõe um modelo próprio para desenvolvimento com IA, começando por LoRA
pequena por tarefa, e deixa "os termos do provedor sobre usar a saída do modelo
para treinar outro modelo" como item a conferir pela Lacre antes do primeiro
treino.

O item já tem resposta, e ela não é de qualidade de dado; é de licença.

**O que o código faz hoje.** Os dois scripts de corpus em
`experiments/slm-pipeline/scripts/` chamam a API da Anthropic com
`claude-haiku-4-5-20251001` para escrever pares de pergunta e resposta sobre
SAFe (`etl_safe_corpus.py:140`, `generate_safe_10k.py:39`). O corpus
versionado tem 127 pares (`data/processed/train.jsonl`). Não há treino no
repositório.

**O que o termo diz.** A Usage Policy da Anthropic, lida em 2026-09-28
(`anthropic.com/legal/aup`, seção "Do Not Compromise Anthropic Products or
Services"), proíbe:

> Utilization of inputs and outputs to train an AI model (e.g., "model
> scraping" or "model distillation") without prior authorization from Anthropic

O texto diz "an AI model", sem qualificar. O Commercial Terms D.4(a) diz
"train competing AI models". Dois textos com alcance diferente; até parecer
jurídico, vale o mais restritivo. Google (Gemini API Terms) e OpenAI (Services
Agreement 3.3(e)) proíbem só modelo "que compita" (relatório do Radar,
2026-09-28, trilha E, verificado).

**O alcance é maior que o corpus de SAFe.** O D-09 propõe como corpus
substituto "o método escrito da Nebuloz, especificações e ADRs revisados por
gente". Esse texto também sai de modelo: a empresa escreve especificação, ADR e
registro de decisão com agentes Claude no Maestri. "Revisado por gente" muda a
qualidade, não a origem. Sem uma regra de proveniência, o LAB (`lab-prd.md`
§4, L-09: "nenhum treino sobre dataset sem classificação") classifica o dado
por sensibilidade e deixa passar o que importa aqui.

Uma segunda fonte já estava excluída pelo próprio registro: os PDFs de
preparação para a prova SAFe Agilist, um deles nomeado "dumps", conteúdo de
terceiro copiado sem licença (D-09, "Uma fonte sai hoje").

## Decisão

**Saída de modelo acessado por API comercial não entra em treino de modelo
próprio sem autorização escrita do provedor, e todo item de dataset no LAB
registra proveniência: quem escreveu, com qual modelo, sob qual termo.**

Em detalhe:

1. **Proveniência por item, não por dataset.** A ficha do LAB (L-06, linhagem
   derivada) ganha três campos obrigatórios por item ou por lote homogêneo:
   `origem` (humano, modelo, terceiro), `modelo_gerador` (identificador exato,
   ou nulo) e `termo_de_uso` (referência ao termo vigente na data da geração e
   à autorização, quando houver). Item sem os três não recebe classificação, e
   L-09 já impede treino sobre dataset sem classificação.
2. **Regra de bloqueio.** Item com `origem = modelo` e `modelo_gerador` de
   provedor cujo termo exige autorização (hoje: Anthropic, pela AUP) só treina
   com a autorização anexada. Item com `origem = terceiro` só treina com
   licença que permita o uso. Texto escrito por gente a partir de rascunho de
   modelo conta como `origem = modelo` até parecer da Lacre dizer o contrário.
3. **O corpus atual não treina.** `train.jsonl` e a saída de
   `generate_safe_10k.py` ficam no repositório como dado de avaliação e de
   experimento, nunca como dado de treino, até haver autorização ou
   substituição.
4. **Nenhum gasto de treino antes de dois pré-requisitos:** o parecer da Lacre
   sobre o alcance de "prior authorization" (AUP) e de "competing" (Commercial
   Terms D.4(a)), incluindo texto revisado por gente; e a suíte de avaliação do
   portão 1 de D-11. Os dois já são exigidos pelo registro; este ADR os torna
   condição de execução, não item de checklist.
5. **Caminhos que continuam abertos:** pedir autorização prévia à Anthropic
   (a AUP a prevê); gerar corpus com modelo aberto sob licença que não restrinja
   a saída (Apache 2.0, como Mistral e Qwen; a licença comunitária do Llama
   restringe e precisa de leitura própria); corpus escrito por gente do zero,
   com custo registrado.

## Alternativas consideradas

- **Tratar como "conferir os termos" no checklist do primeiro treino, como o
  registro faz hoje.** Rejeitada: o texto do termo já foi lido e responde. Um
  checklist que se confere no dia do treino descobre o bloqueio depois de
  gastar a engenharia de preparação. Custo de decidir agora: zero, porque não
  há treino no repositório.
- **Ler a AUP como se dissesse "modelo concorrente", alinhada ao Commercial
  Terms D.4(a).** Rejeitada como premissa de trabalho: o texto da AUP não tem
  o qualificador. Pode ser a leitura correta, mas é a Lacre com advogado quem
  diz, e até lá a empresa não constrói sobre a interpretação mais conveniente.
- **Trocar o gerador por outro provedor (Gemini, OpenAI) cujo termo restringe
  só modelo concorrente.** Não rejeitada, mas insuficiente sozinha: não resolve
  o corpus substituto (specs e ADRs escritos com Claude) nem os PDFs de
  terceiro. Sem proveniência por item, a troca de provedor só muda de quem é o
  termo que ninguém registrou.
- **Proveniência por dataset, um campo só.** Rejeitada: o `train.jsonl` já
  mistura três origens (PDF de terceiro, geração por Haiku, e futuramente texto
  próprio). Um campo por dataset obriga a classificar tudo pela pior origem ou a
  mentir.

## Consequências

**Fica mais fácil.** Responder "esse modelo viu o quê, escrito por quem, sob
qual termo", que é a pergunta que o LAB existe para responder (`lab-prd.md`
§1) e a que um cliente de SV-09 ou SV-10 faz antes de assinar. Portão 2 de
D-11 passa a ter critério verificável.

**Fica mais difícil.** Montar corpus barato. A geração sintética por API
comercial, que era o caminho de 10 mil pares, deixa de ser gratuita em termos
contratuais. O custo real do D-09 sobe e precisa ser recalculado antes de
qualquer "fine-tune grande".

**Precisa ser revisitado quando:** a Lacre entregar o parecer (pode estreitar
a regra 2, se "prior authorization" não alcançar texto revisado por gente);
a Anthropic responder a um pedido de autorização; ou o termo de qualquer
provedor mudar. A data e a versão do termo lido ficam neste ADR para que a
revisão saiba contra o que comparar.

**O que este ADR não decide.** Preço, abatimento, gatilho de D-02 e unidade de
cobrança do Charter são decisões de negócio do mesmo pre-mortem e ficam no
registro de decisões, não em ADR. Os controles estruturais para conteúdo
recuperado no copiloto (D-14.4: escrita confirmada, sem link ou imagem de
conteúdo recuperado, cerca como higiene) são decisão técnica separada e cabem
em ADR próprio.

## Referências

- `docs/socio/2026-09-28-validacao-decisoes.md` — pre-mortem, Causa 2 e §2.1
- `docs/produto/registro-de-decisoes.md` — D-09, D-10, D-11
- `docs/produto/lab-prd.md` §1, §4 (L-06, L-08, L-09)
- `experiments/slm-pipeline/scripts/etl_safe_corpus.py`, `generate_safe_10k.py`
- Anthropic Usage Policy e Commercial Terms of Service, lidos em 2026-09-28
- Relatório do Radar, 2026-09-28, trilha E (verificação dos termos de Anthropic, Google e OpenAI)
