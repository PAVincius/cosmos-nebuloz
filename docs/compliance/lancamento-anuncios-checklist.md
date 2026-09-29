# Checklist de revisão pré-publicação — Lançamento Nebuloz (LinkedIn Ads + orgânico Instagram)

**Autor**: Compliance/DPO · **Data**: 2026-09-26
**Contexto**: CRO (Ponte) rascunhando oferta/anúncios em `docs/comercial/lancamento-oferta.md` (arquivo ainda não existe no momento desta checklist — pendente 1ª passada quando publicado).
**Uso**: nenhum anúncio ou post vai ao ar sem os itens abaixo marcados. Isto é checklist, não aprovação — PARECER final segue modelo de `docs/compliance/2026-09-24-parecer-meridian-respondente.md`.

---

## 1. LGPD — formulários de lead gen (LinkedIn Lead Gen Forms)

- [ ] Base legal definida para captura do lead (consentimento? legítimo interesse? — decisão do CEO, ver `docs/compliance/lgpd-ropa-e-lacunas.md`)
- [ ] Aviso de privacidade linkado no formulário (URL válida, versão atual)
- [ ] Campos coletados = mínimo necessário (nome, e-mail corporativo, empresa — evitar campos extras "porque o LinkedIn oferece")
- [ ] Retenção definida: por quanto tempo o lead fica na base se não virar cliente/oportunidade
- [ ] Fluxo de exportação LinkedIn → CRM mapeado — LinkedIn é operador nesse trecho; confirmar se há DPA/termos aceitos (LinkedIn Marketing Solutions Data Processing Terms) — ver `docs/compliance/dpa-fornecedores.md` para o modelo de checagem
- [ ] Opt-out/exclusão do lead: processo existe e é executável (quem recebe pedido de exclusão de um lead capturado via ads?)
- [ ] Nebuloz = controladora do dado do lead (não operadora) — confirmar entendimento está alinhado com `docs/compliance/operadora-controladora.md`
- [ ] **Cadastro em lista de espera** (adicionado 2026-09-26 — Scaffold/Charter/Cosmos/Signal viram lista de espera, `docs/produto/prontidao-lancamento.md:69-75`): finalidade de tratamento é diferente do lead gen de agendamento do Meridian (aqui é "avisar quando disponível", não "agendar diagnóstico") — precisa base legal e aviso de privacidade próprios para essa finalidade, mesmo que reuse o mesmo formulário/campo técnico.

**Bloqueio**: sem aviso de privacidade publicado E sem base legal decidida, formulário não sobe.

## 2. Marcas de terceiros

- [ ] Toda menção nominativa (Vercel, PostHog, Resend, Sentry, LinkedIn, WhatsApp, **TOTVS**, clientes) é descritiva, não sugere parceria/endosso não existente
- [ ] Ver lacuna já registrada em `docs/compliance/site-riscos-juridicos.md:155` — diretriz de marca de cada terceiro não foi auditada individualmente; anúncio pago tem exposição maior que site orgânico, então checar guideline de uso de marca antes de publicar peça com logo/nome de terceiro
- [ ] Nenhum logo de terceiro usado sem licença/permissão expressa (uso de nome em texto ≠ uso de logo)

## 3. Depoimentos / cases (RTEs; TOTVS é lead, não tem case)

- [ ] Autorização por escrito de cada RTE citado (nome, foto, cargo, frase) — quem depõe deve aprovar o texto final, não só ter sido "citado numa call"
- [ ] **TOTVS é lead, não cliente** — sem trial, sem contrato, sem registro comercial no repo nem no banco de produção (`.maestri/knowledge/maestro/memoria-empresa.md` §project_cosmos_strategy, `docs/comercial/lancamento-oferta.md:80`). Não existe case, depoimento ou autorização de uso de nome dela hoje — não há contrato/NDA para "verificar". Nenhuma peça cita TOTVS nominalmente como cliente/case/parceiro; isso só fica em aberto quando (e se) houver relação comercial fechada e autorização explícita — não é uma pendência para acelerar agora
- [ ] Métricas de resultado citadas em case (ex: "reduziu X% retrabalho") têm fonte rastreável (arquivo + linha/dado), não estimativa de vendas

**Bloqueio**: citar TOTVS (ou qualquer nome/RTE) nominalmente como cliente/case sem autorização registrada bloqueia a peça — hoje bloqueia sempre, porque a autorização não existe.

## 4. Claims de IA / soberania de dados (CDC + CONAR)

- [ ] **Disponibilidade real por produto** (adicionado 2026-09-26, decisão CEO em `docs/produto/prontidao-lancamento.md:69-75` — lançamento escalonado): peça deixa claro que só Meridian está **disponível** ("Diagnóstico sob agendamento"); Scaffold, Charter, Cosmos e Signal são **lista de espera**. Anunciar a suíte inteira sem essa distinção visível = claim de disponibilidade não sustentável (CDC, publicidade enganosa) e expectativa não sustentável (CONAR). Todo anúncio/post que mencione produto fora do Meridian precisa rótulo "lista de espera" no mesmo criativo, não só num link.
- [ ] Nenhuma promessa de resultado garantido ("aumenta produtividade em X%", "elimina retrabalho") sem base factual documentada — CDC (Código de Defesa do Consumidor) trata isso como publicidade enganosa se não comprovável
- [ ] "Soberania de dados" / "dados no Brasil" só é afirmado se for tecnicamente verdade no momento da publicação (região de hospedagem, processamento) — checar com Security/infra antes de usar o termo
- [ ] Claims sobre "IA" descrevem o que o produto de fato faz — não antropomorfizar nem prometer autonomia/decisão que o sistema não tem (risco CONAR: publicidade enganosa por criar expectativa não sustentável)
- [ ] Comparação com concorrentes (se houver) é factual e comprovável — CONAR proíbe denegrir concorrente ou comparação não-objetiva

## 5. Políticas de anúncio das plataformas

- [ ] **LinkedIn Ads**: peça revisada contra LinkedIn Advertising Policies (claims de emprego/RH, uso de "garantido", linguagem discriminatória em segmentação)
- [ ] **Meta/Instagram** (orgânico não entra em ad policy, mas se houver impulsionamento): checar Meta Advertising Standards se algum post for promovido
- [ ] Segmentação de público não usa categoria sensível (saúde, orientação, etc.) — não parece aplicável ao ICP B2B, mas confirmar antes de configurar audience

---

## Decisões que o CEO precisa tomar

1. Base legal do lead gen form (consentimento vs. legítimo interesse)
2. TOTVS é lead, não cliente — não há pedido de autorização a iniciar hoje; a pergunta só se coloca ao CEO se/quando existir relação comercial fechada com ela
3. Se algum claim de "soberania de dados" será usado — precisa confirmação técnica antes

## Decisões (registro)

_(preencher conforme CEO decide, com data)_

---

## Revisão v1 — `docs/comercial/lancamento-oferta.md` (2026-09-26)

1ª passada contra este checklist. Ponte já autoflagra vários pontos (não citar TOTVS/RTE sem autorização, sem preço fechado, sem escassez falsa) — reduz achados novos.

### Achados por peça

**Anúncios LinkedIn (V1, V2, V3 — seção 2)**
- **Bloqueio (as 3 variações)**: CTA "[Agendar sessão de diagnóstico]" não tem destino definido no rascunho — não fica claro se é LinkedIn Lead Gen Form nativo (coleta dado dentro do LinkedIn) ou link para página/agenda externa. Sem isso definido, não dá para checar item 1 (base legal, aviso de privacidade, retenção) — mecanismo muda o que precisa existir antes de publicar. **Pedir ao Ponte para especificar destino do CTA.**
- Copy em si: sem preço, sem promessa de resultado garantido, sem escassez falsa, sem nome de terceiro/cliente — item 4 (CDC/CONAR) e item 2 (marcas) OK como está.
- V3 usa "Big Four" (termo genérico de mercado, não marca específica) em comparação de custo/prazo — não nomeia concorrente, risco CONAR baixo. Números (USD 100–500 mil) ficam só na hipótese interna (`icp-e-precificacao.md`), não aparecem na copy do anúncio — OK.
- Garantia (A) "devolvemos o valor" (seção 1) não está na copy dos anúncios, só no documento de oferta. Se entrar em criativo futuro, precisa termos claros (prazo, condição de devolução) antes de publicar — CDC trata promessa de reembolso vaga como risco de publicidade enganosa. Sem decisão do CEO sobre (A) vs (B), não incluir garantia em nenhuma peça.

**Post 1 — LinkedIn pessoal do fundador (bastidor)**
- Sem link, sem formulário, sem nome de cliente, sem claim de resultado. **Sem bloqueio de compliance** — pode ir ao ar como está (sujeito às decisões de negócio da seção 0 do doc do Ponte, que não são compliance).

**Post 2 — Instagram carrossel**
- Mesmo bloqueio do CTA de link ("link na bio") que os anúncios: se a bio aponta para o mesmo booking/lead form, precisa do mesmo aviso de privacidade/base legal resolvido. Conteúdo do carrossel em si (slides 1–4) não cita cliente, não promete resultado — OK.

**Post 3 — cruzado (marco de lançamento)**
- Mesmo bloqueio de destino de link ("comentários/bio"). Copy não cita TOTVS nem nome — OK.

### Resumo do bloqueio único que afeta 5 das 6 peças
Todas as peças com CTA de link (V1, V2, V3, Post 2, Post 3) dependem da mesma definição pendente: **para onde o link/CTA aponta e se esse destino tem aviso de privacidade e captura de dado conforme.** Só Post 1 (sem link) está livre desse bloqueio.
