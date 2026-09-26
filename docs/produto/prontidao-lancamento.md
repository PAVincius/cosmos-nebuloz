# Prontidão para lançamento — cliente externo

- **Autor:** Norte (CPO) · **Data:** 2026-09-26 · **Pedido por:** Ordem (CoS), em nome do CEO
- **Pergunta:** lançar todos os produtos juntos, com um preview/versão gratuita do Meridian como isca?
- Sem código e sem tarefa de engenharia aberta. Estimativa marcada como hipótese.

## 1. Prontidão por produto (hoje)

| Produto | SCs formais | Tasks do spec | Dogfood | Bloqueio para cliente externo | Veredito |
|---|---|---|---|---|---|
| **Meridian** | 10 (`specs/001-meridian-diagnose/spec.md`) | 79/82 | Em produção desde 2026-09-25: M1 OK, M2 em execução (`docs/qualidade/dogfood/meridian/diario.md`) | 4 P2 + 1 P3 abertos (`atrito.md:42,48,54,60,130`); compliance **bloqueia uso externo** até as condições 2–5 (`docs/compliance/2026-09-24-parecer-meridian-respondente.md` §4). A condição 1 (aviso ao titular) já saiu no commit `24f7b299` | Mais perto; ainda não pronto |
| **Charter** | **Nenhum** (`docs/qualidade/2026-09-23-plano-dogfood-esteira.md:21`) | sem spec kit | Não começou | Sem SC não há critério de saída (`plano-dogfood-esteira.md:102`) | Não pronto |
| **Cosmos** | **Nenhum** — 22 requisitos no PRD (`plano-dogfood-esteira.md:22`) | — | Não começou | Mesmo bloqueio do Charter | Não pronto |
| **Scaffold** | 7 (`specs/002-scaffold-adoption/spec.md`) | 140/142 | Não começou (posição 2 da esteira) | Depende de lacuna promovida do Meridian | Código pronto, sem validação |
| **Signal** | **0** (`specs/003-signal-measure/spec.md`) | 90/92 | Não começou | Sem SC; preço de tabela R$ 1.200 sem implementação de cobrança (`docs/comercial/mapa-de-processo.md:64`) | Não pronto |

Leitura: **nenhum produto está pronto para cliente externo em autosserviço hoje.**
O Meridian é o único com SC, dogfood em produção e parecer de compliance. Os
bloqueios dele são conhecidos, têm dono e são finitos.

## 2. Preview/versão gratuita do Meridian

**Escopo mínimo que não canibaliza (proposta):**
- Autoavaliação de **um respondente só** (o próprio comprador, CIO/CTO), sem
  convite a terceiros e **sem upload de evidência**.
- Saída: nota por eixo + "o que o diagnóstico completo revela" (divergência entre
  respondentes, evidência auditada, plano priorizado). Esse conteúdo fica exclusivo do SKU 1.

**Canibalização do SKU 1:** o SKU 1 é projeto conduzido, cobrado uma vez
(`docs/comercial/icp-e-precificacao.md:80`), e o valor dele está no
multi-respondente, na evidência e no plano. Um preview que entrega só a
autopercepção de uma pessoa **não canibaliza e qualifica o lead**. Um preview
com multi-respondente ou evidência **canibaliza**. O CTA atual já é uma call
gratuita que qualifica antes de cotar (`docs/comercial/lancamento-oferta.md:41`),
e o preview entraria no mesmo lugar do funil.

**Riscos:**
- **LGPD:** com um titular só, que é o próprio usuário, sem evidência, as
  condições 2, 3 e 5 do parecer ficam de fora. **A condição 4 continua valendo**
  (decisão operadora/controladora + cláusulas C1–C7 no `dpa-modelo.md`). Vira
  também um fluxo novo de coleta de dado de lead, que precisa de base legal e
  aviso próprios. Pedir parecer à Lacre antes.
- **Custo de IA:** o Meridian não chama LLM hoje (grep por SDK de IA em
  `apps/app/app/(meridian)` não retorna nada), então o custo marginal é ~zero. O
  custo aparece **se** o preview incluir resumo gerado por IA. Recomendo que não
  inclua.
- **Autosserviço não existe:** entrada sem login e provisão de tenant automática
  ainda estão em spec (`specs/004-login-generico-produto/` tem só intent e spec).
- **Custo real:** tempo do fundador atendendo leads frios.

**Esforço (hipótese, sem estimativa de engenharia):** 2–3 semanas, dominado
pelo login/tenant de autosserviço (spec 004), não pelo questionário.

## 3. Disponível vs lista de espera

| Produto | Anunciar como |
|---|---|
| Meridian | **"Diagnóstico sob agendamento"** (SKU 1 conduzido por nós). O primeiro cliente só entra depois das condições 2–5 de compliance e dos P2 de segurança (`atrito.md:42,48`) fechados. O preview vira um segundo passo, depois da spec 004 |
| Charter, Cosmos, Scaffold, Signal | **Lista de espera** |

**Sobre lançar tudo junto:** recomendo não fazer. Anunciar como "disponível" um
produto sem critério de saída põe o primeiro cliente para fazer o QA. A esteira
do dogfood (Meridian → Scaffold → Charter → Cosmos → Signal) já é a ordem de
liberação. Anunciar a **suíte** e liberar **produto a produto** comunica a visão
sem prometer o que não foi validado. A decisão é do CEO.

## Decisões

- (pendente CEO) Lançamento simultâneo vs escalonado.
- (pendente CEO) Preview do Meridian: aprovar escopo "1 respondente, sem evidência, sem IA".
- (pendente CEO/jurídico) Pergunta 1 de `docs/compliance/operadora-controladora.md` §5.
