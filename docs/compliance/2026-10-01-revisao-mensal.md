# Revisão mensal de Compliance — setembro de 2026

- **Data:** 2026-10-01
- **Autor:** Compliance / DPO
- **Escopo pedido:** (1) `risk-register.md`; (2) DPAs vencendo; (3) feature entregue no mês que toque dado pessoal sem parecer.
- **Método:** lista de commits de `github/main` desde 2026-09-01 (763 não-merge, 50 merges de PR), filtrada pelos caminhos que tocam dado pessoal (schema, jobs, cron, auth, reunião, respondente, storage, IA, e-mail, auditoria). Li `risk-register.md`, `dpa-fornecedores.md` e os pareceres em `docs/compliance/`. **Não li o código das features**: a triagem é por título e caminho de arquivo, e o que marco como "sem parecer" é "não encontrei parecer", não "viola". Não vi produção.

## 1. Risk register

**Estado:** a "próxima revisão" era **2026-07-01**, três meses vencida. A última alteração do arquivo foi o R-013, em 2026-09-24. Doze das treze linhas estavam com revisão de julho ou agosto.

**O que fiz** (PR em `docs/compliance/risk-register.md`):
- **Atualizei só o que é de privacidade**, e disse isso no cabeçalho: R-001, R-004, R-008, R-009 e R-013 (sem mudança). As linhas de segurança e infraestrutura (R-002, R-003, R-005 a R-007, R-010 a R-012) **não foram revisadas por mim** e continuam com data vencida; os donos precisam rever.
- **Mudanças de classificação, para você conferir:**
  - R-004 (trilha adulterável): Média para **Baixa**. Há trigger que barra UPDATE e DELETE (ADR-0009, confirmado no parecer de reset de 2026-09-29).
  - R-008 (DSAR): Alta para **Média**. O DSAR existe e roda por cron; o que falta é o titular sem conta e a prova em produção.
  - R-009 (DPA, RoPA, DPIA): Alta para **Média**. O RoPA e o DPA modelo existem; a dispensa do encarregado deixou de ser ação.
  - R-001 (vazamento entre tenants): Alta para **Média**. O texto também mudou: a RLS está declarada mas **não é a barreira ativa** (ADR-0012, DPA §7). A reclassificação é julgamento meu, apoiada em chaves únicas compostas e testes de fronteira recentes; o Backend Lead pode discordar.
- **Seis riscos novos**, todos de coisas que apareceram neste mês:

| ID | Risco | Prob. | Imp. | Revisão |
|---|---|---|---|---|
| R-014 | Retenção e eliminação por cron não verificadas em produção | Média | Alto | 2026-10-15 |
| R-015 | Mecanismo de transferência internacional não demonstrado (Res. CD/ANPD 19/2024) | Alta | Alto | 2026-10-31 |
| R-016 | Supabase (banco, bucket, backups) sem DPA registrado | Média | Alto | 2026-10-15 |
| R-017 | Benchmark do Meridian ligado por engano torna a Nebuloz controladora | Baixa | Alto | 2026-10-15 |
| R-018 | Buckets do Scaffold e do Charter sem rotina de retenção | Média | Médio | 2026-10-31 |
| R-019 | Respondente externo sem canal no produto | Média | Alto | antes do 1º cliente externo |

Próxima revisão do registro: **2026-11-01**.

## 2. DPAs: o que vence ou está em aberto

**"Vencendo" eu não consigo dizer.** `dpa-fornecedores.md` não tem coluna de vigência ou renovação, e o `renewalAt` do inventário do Charter está no default de propósito (`charter-nebuloz.ts`, comentário na linha 26). Sem data de contrato, não existe "vence em tal data". Recomendo o CEO ou Pilar preencherem `renewalAt` por fornecedor quando confirmarem cada contrato.

**O que existe de concreto, com a verificação de 2026-09-05 já com 26 dias:**
| Situação | Fornecedores | Prioridade |
|---|---|---|
| **Sem DPA registrado, e em uso em produção** | **Supabase** (banco, Storage, backups); V-05 lista Neon | **Alta** (R-016) |
| A assinar (existe documento, só vale com aceite) | Langfuse V-04, Upstash V-07, Sentry V-08, Fireflies V-11, PostHog V-12, Knock V-16 | Alta para Sentry e Upstash (recebem dado em produção hoje); Langfuse mantém captura de conteúdo desligada |
| Sem documento público | Arcjet V-13, Inngest V-14, Svix V-15, BaseHub V-17 | Média. O Inngest perdeu peso depois do #310 (retenção e eliminação saíram dele) |
| Embutido, com mecanismo de transferência "não confirmado" | OpenAI V-02, Google V-03, Neon V-05 | Ligado ao R-015 |
| Revisão marcada | R-013: 2026-10-23 (confirmar o plano Vercel Pro/Enterprise para o ZDR por requisição) | Prazo próximo |
| Novo, ainda não registrado | OpenAI **Realtime** (áudio), se o guia de voz seguir; provedor de voz alternativo | Parecer do guia de voz (`638b0be1`, ainda local) |

**Reverificação:** a fonte primária desses documentos muda. Proponho refazer a verificação de `dpa-fornecedores.md` até **2026-10-15**, começando por Supabase, Sentry e Upstash.

## 3. Features do mês que tocam dado pessoal sem parecer

Critério: entregue (mergeada) em setembro, toca dado pessoal ou o tratamento dele, e **não encontrei parecer** em `docs/compliance/`. Pareceres existentes: triagem Jev (09-23), Meridian respondente (09-24), retenção da evidência #277 (09-28), reset de produção (09-29), e o parecer prévio do guia de voz (09-30, ainda não mergeado).

| # | Feature (PR ou commit) | Dado pessoal | Risco | Parecer devido |
|---|---|---|---|---|
| 1 | **Benchmark do Meridian travado por tenant** (spec 012: #318, #323, #327; tabela `MeridianBenchmarkEnablement`) | Respostas de respondentes compõem conjunto comparativo; ligar faz da Nebuloz controladora | **Alto** | **Sim, antes de qualquer habilitação:** conferir o desenho da trava, a linha de RoPA e o aviso ao respondente (R-017). A mensagem "referência do aditivo leva só o número" (`c5393da1`) precisa ser lida contra o DPA §2.1 |
| 2 | **Upload de evidência no Charter e no Scaffold** (`ba76ba89`, `068f5daa`: URL assinada, download auditado) | Arquivos livres do cliente, que podem ter dado pessoal | **Médio** | **Sim:** só o Meridian tem retenção (R-018). É a mesma lacuna do parecer de 2026-09-24 |
| 3 | **Backoffice: funil de leads v2, empresa (fornecedores, consentimento, lançamentos, CAC)** (`c830e60d`, `4615728a`, `78cbb495`, `40672383`) | Nome e e-mail de contato de prospect; histórico de estágio e canal | **Médio** | **Sim:** é a finalidade 9 do RoPA (legítimo interesse, **retenção não definida**); campos novos precisam entrar na linha |
| 4 | **Signal: módulo de medição, baseline, plano de métricas, conexões** (#182 e série SG-DEV de 09-29) | Donos de iniciativa, observações de métrica, conexões a sistemas externos | **Médio** | **Sim:** nunca tratado em parecer; confirmar se há dado pessoal, onde guardam credenciais das conexões e quem lê |
| 5 | **Scaffold: papéis SPONSOR e TEAM_LEAD, vínculo externo (Linear, GitHub, Jira), métricas do produto "para a consultoria" (SC-PM-04)** | Atribuição de papel a usuários; leitura por staff atravessando clientes | **Médio** | **Sim, curto:** o acesso de staff a dado de cliente é o ponto aberto do DPA §4 (não há registro de leitura). A spec 017 (motivo de dispensa) já recebeu nota minha |
| 6 | **Autenticação: troca de senha logado e "esqueci a senha" ponta a ponta** (`747cb078`, `db4fd711`) | E-mail, sessões, token de redefinição; envio por e-mail | **Baixo** | Checklist curto, sem parecer completo: token de uso único e com expiração, rate limit (já há, `db4fd711`), mensagem sem oráculo de existência de conta, e-mail sem dado além do necessário |
| 7 | **Maestri: Vigilante e camada de Receita com modelo local** (`036b3edf`, `640047a3`) | Provável dado comercial interno (leads, receita) | **Baixo a médio** | **Sim, se a camada de Receita ler dado de lead ou de cliente:** modelo local reduz a transferência, mas não a finalidade |
| 8 | **AI Law Watch** (`b0b9ff95`, `7d93efc3`) | Não: leis, sem dado pessoal | Nenhum | **Não** |

**Pareceres dados em conversa e não registrados em documento.** A regra é que a decisão vira registro. Estes ficaram só em chat com a Morgana, e o primeiro tem peso contratual:
- **#310 (cron: retenção e eliminação)** — OK com condições, 2026-09-30; passos 1 a 5 de verificação. Informa a "data de verificação" do DPA §10.2. **Registrar** (o roteiro sintético o cita, mas não o parecer).
- **Spec A3 / #305 (evidência em Coleta)** — pode usar o nome do arquivo como rótulo, com três ajustes (FR-006 estendido ao rótulo, FR-010 ampliado, texto escapado), 2026-09-30. O parecer de A3 do #313 existe como PR; confirmar que é este.
- **D-24 (ligação entregável e cláusulas do Charter)** — quatro referências que não sustentam (`NIST-MANAGE-1` e `AIA-09` em E1.1, `LGPD-ART37` em E2.1, `ISO-CL08` em E2.2), 2026-09-30.
- **Spec 017 (motivo da dispensa)** — dica na tela mais categoria fechada, 2026-09-30.

Posso registrar os quatro em um documento próprio se você quiser; o #310 deve entrar antes de o DPA §10.2 citar a data de verificação.

## 4. O que precisa de decisão

| # | Decisão | Dono |
|---|---|---|
| 1 | Autorizar parecer sobre o benchmark antes de qualquer habilitação (R-017) | CEO / Norte |
| 2 | Prazo de retenção dos buckets do Scaffold e do Charter (R-018) | CEO |
| 3 | Preencher vigência e `renewalAt` de cada fornecedor, e registrar o Supabase (R-016) | CEO / Pilar |
| 4 | Revisão jurídica do DPA modelo e do mecanismo de transferência (R-015) | Jurídico |
| 5 | Donos de R-002, R-003, R-005 a R-007 e R-010 a R-012: revisão vencida desde julho | Backend Lead, DevOps, Eng Lead |

## Decisões

- 2026-10-01 — Compliance/DPO: risk register revisado na parte de privacidade; classificações de R-001, R-004, R-008 e R-009 reduzidas; seis riscos novos (R-014 a R-019); próxima revisão 2026-11-01.
- 2026-10-01 — Compliance/DPO: parecer devido, antes do primeiro cliente externo, para o benchmark, o upload de evidência (Charter e Scaffold), o funil de leads e o Signal. Os demais itens da §3 ficam como checklist curto ou sem parecer.
