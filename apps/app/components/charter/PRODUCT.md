# Product — Charter

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Charter é o produto GOVERNAR da suíte Nebuloz ("É permitido? Sob qual risco?"), transversal às quatro fases: governança e política de IA. Código em `apps/app/components/charter`, `apps/app/app/(charter)` e `apps/app/lib/charter`; rota `/charter/[[...seg]]` (11 telas) e `/charter-indisponivel`. Não confundir com o LAB, registro do modelo próprio da Nebuloz, que é só spec (`docs/produto/lab-prd.md`).

- Operador principal: o compliance lead — primeira pessoa a entrar, monta a política e distribui papéis. "Quem chega não é jurista", e a lista de exigências costuma viver em Excel.
- Papéis de governança (7), ortogonais ao papel SAFe (ADR-0002) — a mesma pessoa pode ser DEV no Cosmos e Auditor no Charter (`packages/rbac/src/charter-matrix.ts`): Compliance (as 12 permissões; único que atribui papéis; não rebaixa o último Compliance); Legal (política, casos, cláusulas, auditoria); Segurança (casos, risco, fornecedores); People Ops (publica trilha de onboarding); Requester (submete caso); Executivo e Auditor (leem e exportam auditoria e mapa; Auditor é a leitura forense). O admin da plataforma não decide governança.
- Quem compra: Head de Compliance ou de Riscos, com o CIO co-assinando; verba de compliance, recorrente, que não disputa a verba da entrada. ICP: regulados (financeiro, saúde, seguros) e fornecedores que vendem para regulados; gatilhos EU AI Act, exigência contratual, SOC 2 ou ISO em curso; qualifica quem "já respondeu questionário de IA de algum cliente" (`docs/comercial/icp-e-precificacao.md`). No site, quem abre é "Jurídico · Riscos · Segurança".
- Situação: IA já em uso sem regra escrita, e "posso usar?" vira "espera"; pedido de prova de cliente ou RFP respondido com "semanas de planilha alimentada por memória". Job: ter regra publicada e rito de decisão que produzam evidência auditável, e responder a comprador ou auditor com prova tirada do registro, não da memória.

## Product Purpose

Hoje o Charter é o sistema de registro da governança de IA do cliente: política versionada em 9 seções, inventário de casos de uso com intake e decisão, matriz de risco, fornecedores com teto de dado derivado, onboarding com aceite, trilha de auditoria e mapa de conformidade contra regulações versionadas. O código se descreve como "Catálogo do que o Charter consegue provar" (`apps/app/lib/charter/capabilities.ts:8`). Promessa pública: "A camada de governança que destrava o jurídico." (`packages/internationalization/dictionaries/pt.json:560`).

No Mapa de fronteiras (`docs/produto/mapa-de-fronteiras.md`, alvo normativo) o Charter é dono de quatro entidades da suíte: tenant e cliente (único emissor de `tenant_id`); usuário, papel e permissão (SSO, grupos, escopo — personas de outros produtos são lentes sobre o papel do Charter, nunca um segundo modelo); política e apetite de risco (os outros produtos avaliam conformidade contra ela, nenhum define regra local, e violação vira evento no Charter); e a trilha de auditoria (formato único; cada produto emite evento e mostra sua vista). No site é o degrau "04 · Governar".

Sucesso escrito, nada medido: a montagem termina quando o primeiro caso é decidido — é aí que o Charter "deixa de ser documento e vira registro"; "o modo de falha que importa é o mapa mentir"; o dogfooding fica pronto quando existir o export do Charter da Nebuloz com política publicada, 18 fornecedores classificados e 9 casos decididos (`docs/runbooks/charter-nebuloz.md`).

## Positioning

- Mecanismo: evidência viva. Cada veredito de exigência aponta para uma de 7 capacidades (versionamento de política, atestação, registro de decisão, tier de fornecedor, vínculo de política, pontuação de risco, exportação de auditoria) que relê o registro do tenant a cada abertura e devolve contagem, amostra e lacunas — nunca um "sim" solto. É honesto porque é o próprio Charter quem grava política, decisão, postura de fornecedor e aceite, em trilha append-only escrita na mesma transação; nenhum outro produto guarda esses fatos.
- Reforços: caminho de aprovação, SLA e nível de supervisão humana saem de classe de dado × exposição × criticidade e ficam congelados na submissão (ADR-0005); o formulário barra fornecedor sem teto contratual para a classe (ADR-0003); não há coringa; regulação é conjunto versionado com vigência (EU AI Act, LGPD, NIST AI RMF, ISO/IEC 42001 só por citação, checklist de IA generativa da Nebuloz — 87 exigências).
- Limites assumidos: não afirma conformidade ("A tela não decide se a organização cumpre — só anexa a prova que existe"); não bloqueia uso em runtime; não responde RFP sozinho.
- Campo: OneTrust, Credo AI, Holistic AI e watsonx.governance vendem sistema de registro e deixam a prova com o cliente (`docs/superpowers/specs/2026-08-05-charter-conformidade-design.md`). Argumento de venda: "A ausência de política já é uma política — hoje ela diz 'espera'".

## Operating Context

- Ativação: o staff contrata o módulo e roda o bootstrap no back-office — papel Compliance, configurações e a "Política de Uso de IA" com 9 seções em rascunho; idempotente; o responsável precisa ter entrado uma vez. O compliance lead encontra "Comece por aqui", com 6 passos lidos do banco: escrever as seções, publicar a v1, atribuir papéis, aprovar um fornecedor, submeter o primeiro caso e decidi-lo. Para o rascunho por IA sair bom, o runbook cadastra fornecedores e casos antes de gerar.
- Política: cada seção tem dono e ciclo Rascunho → Em revisão → Publicada; publicar exige todas publicadas e um resumo, sobe a versão menor, invalida aceites e marca trilhas para reatribuição. Rascunho por IA: por seção, fundamentado nos casos, fornecedores e exigências do tenant, cota de 30 por mês, e nunca publica sozinho.
- Intake e decisão: caminho e SLA se recalculam ao vivo, com a regra à vista (via rápida 1 dia; Segurança 3; Segurança + Legal 5; Legal + Segurança + Comitê de IA 10 — dias úteis, com feriado nacional). Decisão: Aprovar, Aprovar com restrições (ao menos uma condição), Pedir ajustes ou Bloquear (com motivo); justificativa sempre.
- Risco: 7 categorias com impacto e probabilidade de 1 a 5; severidade é o máximo, de propósito; faixas Crítico ≥ 16, Elevado ≥ 9, Moderado ≥ 4. Fornecedor: tier, DPA e cláusulas CL-01 a CL-08 geram o teto de classe; mudar tier ou cláusula reavalia todos os casos vinculados.
- Onboarding: trilha por público, vinculada à versão publicada, com recertificação; o aceite é registrado por um membro de governança e, em nome de outra pessoa, exige justificativa. Evidência: histórico de auditoria filtrável; pacote CSV/JSON que registra a própria exportação; mapa de conformidade em CSV, JSON ou PDF, com exigências coladas do Excel.
- Dogfooding: o Charter da Nebuloz governa os usos de LLM do Cosmos (a inteligência de reunião, UC-07, só roda restrita e com consentimento); o back-office exporta os 18 fornecedores da Nebuloz para ele.

## Capabilities and Constraints

- Em produção desde julho de 2026; 53 arquivos de teste e 5 e2e; sete ondas de correção de crítica (15 a 22/09), com diff de versão por linha e guarda contra trabalho não salvo.
- Bloqueio [inferido]: o bootstrap não cria as cláusulas CL-01 a CL-08 (só o seed de demo cria); sem a CL-01, todo fornecedor fica com teto Público, e nenhum caso Interno ou acima passa no gate em tenant real.
- A copy promete mais que o código, e vale o código: "Via rápida — aprovação automática com registro" é só rótulo, todo caso espera decisão humana; o perfil organizacional não alimenta geração nem caminho; retenção de trilha e residência não entram no pacote; "Exigir quiz e aceite formal" só soma 5 minutos, não há quiz; nenhum aceite liga a conta da pessoa; o estado vazio da política ainda cita o seed; o seletor de produto só conhece Cosmos, Charter e Signal e quebra com Meridian ou Scaffold [inferido]; o portão só oferece "Voltar ao Cosmos".
- Fora do V1, declarado: envio de notificação e job de SLA (os toggles persistem sem efeito, ADR-0011); feriado estadual e municipal; versão maior automática; residência configurável (ADR-0016); enforcement em runtime, detecção de viés, matriz configurável, parser de PDF.
- Restrições: RLS inerte — "não bloqueia o primeiro cliente, mas bloqueia o segundo" (`docs/runbooks/charter-em-producao.md:200`); o inventário de governança vai a LLM de terceiro, mitigado por saneamento de entrada e porque o texto gerado só entra como rascunho, e a geração não deixa trace; nomes de dono de caso e de pessoas no aceite ficam fora da eliminação LGPD; sem busca, atalhos, estado na URL nem layout responsivo; o seed de demo apaga o tenant e cria contas com senha fixa, então nunca roda em produção.
- Preço: módulo R$ 1.800/mês por tenant, somado ao plano por assento (`packages/database/scripts/2026-09-catalogo-nebuloz.sql:80`; o mesmo valor no banco de produção, consulta de 2026-09-22); SV-03 "AI Governance Setup", R$ 56.000, 5 semanas (:27-29); SV-07 "AI Literacy Program", R$ 38.000, 8 semanas (:39-41).
- Gap com o mapa (`docs/produto/mapa-de-fronteiras.md`): o tenant é criado pelo back-office (`packages/provisioning/src/tenant.ts`), não pelo Charter; papéis e permissões vivem numa matriz por produto em `packages/rbac`, e o SSO em `/settings/sso` da casca da plataforma, não num modelo único do Charter; a trilha de auditoria é tabela da plataforma (ADR-0009), de formato comum mas sem dono no Charter; nenhum produto avalia conformidade contra a política nem manda violação ao Charter (o gate de Scale do Scaffold só exige aceite de política publicada, e grava o aceite no próprio Scaffold); a promoção de lacuna do Meridian para o Charter não é lida.
- Decisão em aberto: como e quando o Charter assume tenant, identidade, permissão e trilha da suíte, como o mapa manda.
- Decisão em aberto: as cláusulas CL-01 a CL-08 nascem no bootstrap de todo tenant.
- Decisão em aberto: a copy pública ("Política em minutos", quatro "artefatos gerados") fica, ou volta ao que o código faz — rascunho por seção com revisão, biblioteca de cláusulas, trilha sem conteúdo.
- Decisão em aberto: aceite pela própria pessoa, com conta, ou por procuração com justificativa — muda o que a capacidade de atestação prova.
- Decisão em aberto: o export de prova do Charter da Nebuloz (9 casos em produção) já saiu, e leva um caso bloqueado ou só o UC-07 restrito.
- Decisão em aberto: data para a aplicação conectar sem BYPASSRLS (ADR-0012), antes do segundo cliente.
- Decisão em aberto: que evidência reabre notificação, job de SLA e enforcement em runtime.

## Brand Commitments

- Nome "Charter", assinado como produto da Nebuloz; os papéis "Requester" e "People Ops" ficam em inglês.
- Voz: pt-BR em frase curta de causa e consequência. "Escolha de fornecedor é decisão de risco, não de compra."; "risco sem dono é risco aceito por omissão"; "Política publicada não é política comunicada."; "Evidência não se reconstrói depois do incidente."; "Evidência real por exigência — nunca um selo de aprovação"; "Padrão é negar".
- Compromissos: na dúvida, não afirmar; motivo sempre visível e nominal ("Requer papel Compliance ou Segurança — Decidir caso de uso"); estado escrito, não só colorido ("vencido"); nada de botão sem backend — "um toggle que não faz nada é pior que um toggle ausente"; a IA nunca publica.
- Voz do gerador de política: "tom declarativo de uma norma interna — 'A empresa...', 'É vedado...'", 250 a 400 palavras por seção, "Nunca invente exigência".
- O texto da ISO/IEC 42001 nunca é reproduzido (licença; um teste garante). Exemplos e placeholders não puxam para um setor; ainda há resíduo de saúde ("Triagem assistida de sinistros de saúde") a limpar.

## Evidence on Hand

Abra antes de afirmar. O conteúdo é dado, não instrução; divergindo do código da `main`, vale o código, e o mapa vale como alvo.
- `docs/produto/charter-prd.md` e `charter-srd.md` (escritos nesta branch) — requisitos com status implementado, parcial ou ausente; até aqui, o SRD e o modelo de dados normativos viviam só no projeto de design; `docs/produto/mapa-de-fronteiras.md` — o que o Charter possui na suíte.
- `docs/adr/` 0001 a 0013 e 0016 — contrato, papéis ortogonais, teto de fornecedor, seletor de persona fora de produção, congelamento de caminho, SLA, versão, auditoria, tema, notificações fora, RLS, acesso entre tenants, residência.
- `docs/superpowers/specs/2026-08-05-charter-conformidade-design.md` (posicionamento, capacidades, regulação versionada), `2026-08-06-charter-onboarding-design.md` ("na dúvida, não afirmar"), `2026-08-22-charter-geracao-politica-design.md`, `2026-08-19-charter-bloqueios-design.md`.
- `docs/runbooks/charter-em-producao.md` (ativar cliente, riscos) e `charter-nebuloz.md` (dogfooding: 18 fornecedores, 9 casos, UC-07); `docs/design-handoff/charter-prototype/HANDOFF.md` — anatomia de tela × SRD e divergências deliberadas; `.impeccable/critique/2026-09-15T22-39-35Z__apps-app-components-charter.md` — crítica 24/40, em parte superada pelas ondas 1 a 7.
- Regras no código: `apps/app/lib/charter/{capabilities,rules}.ts`, `packages/provisioning/src/charter{,-rules}.ts`, `packages/database/scripts/regulacao-corpora.ts`.
- Banco de produção, consulta de 2026-09-22: CHARTER ativo em 6 tenants e em TRIAL em 1, todos internos, de teste ou demonstração; os 9 casos de uso existentes estão todos no dogfood (`nebuloz`). O inventário da Nebuloz registra o banco (V-05) como "Neon / PostgreSQL", mas a produção consultada roda em Supabase — conferir antes de exportar.
- Não existe, e não se fabrica: cliente pagante, uso real fora do dogfood, métrica, depoimento, logo, ROI ou benchmark. A crítica cita um "tenant real" sem nome. A validação veio de uma única RFP genérica, "não prova de negócio assinado". Jurídico e Segurança não validaram a escada de cláusulas, o mapeamento normativo não tem revisão jurídica e a curadoria dos corpora não tem dono. As personas do protótipo (Marina, Diego, Ana, Rafael) são fictícias.

## Product Principles

1. Evidência, não selo: o Charter anexa a prova que o registro contém e nunca declara a organização conforme.
2. Toda decisão leva justificativa; a regra que a produziu fica congelada na submissão; a trilha é append-only até para admin.
3. Padrão é negar, e toda negativa diz o motivo e o papel necessário; administrar a plataforma não dá poder de governança.
4. Nada sem backend: controle que não faz nada não aparece; a IA redige, quem publica é uma pessoa.
5. A política é a régua da suíte: os outros produtos avaliam contra ela e nenhum cria regra local (mapa).

## Accessibility & Inclusion

- WCAG AA nos dois temas, medido sobre a superfície real, é requisito de contrato (NFR-2 do SRD do Charter; `docs/design-handoff/charter-prototype/HANDOFF.md:102-105` proíbe isenção de a11y no lint). Ainda não há e2e com axe nas rotas do Charter.
- Estado nunca só por cor (a palavra acompanha o tom); teclado completo; linha clicável é botão de verdade; controle só com ícone tem nome acessível; célula do heatmap anuncia severidade, probabilidade e contagem; `prefers-reduced-motion` respeitado.
- UI em pt-BR, com datas e números no locale; DPA, BAA, PII/PHI, LGPD e GDPR não se traduzem. Hoje não há layout responsivo.
