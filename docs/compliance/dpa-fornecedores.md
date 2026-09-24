# DPA dos fornecedores — estado real, por fonte primária

Verificado em 5 de setembro de 2026. Fornecedores conforme
`packages/provisioning/src/charter-nebuloz.ts` (`NEBULOZ_VENDORS`) e
[`docs/runbooks/charter-nebuloz.md`](../runbooks/charter-nebuloz.md) §5.

## 0. Como ler

**"Embutido"** quer dizer que o acordo de tratamento de dados já vale pelo uso
do serviço: o próprio contrato comercial incorpora o DPA por referência, e as
cláusulas-padrão de transferência são dadas por assinadas pelo mesmo ato. Não
há nada a fazer além de guardar o link. **"A assinar"** quer dizer que existe um
documento, mas ele só produz efeito quando alguém da Nebuloz aceita no portal do
fornecedor ou assina uma via — enquanto isso não acontece, não há DPA, há um
modelo de DPA. **"Não encontrado"** quer dizer que a busca em fonte primária não
localizou documento público; não que não exista sob NDA ou no plano empresarial.

Um asterisco (\*) na tabela marca classificação provisória: o documento existe,
mas o texto não pôde ser lido aqui (PDF sem camada de texto, portal dinâmico).
Está listado na seção 4.

Isto alimenta o inventário do Charter em produção — o modelo `CharterVendor` em
`packages/database/prisma/schema/charter.prisma`, campos `dpa` (booleano),
`retention`, `subprocessors` (contagem), `region`, `renewalAt`, `score` e
`maxClass`. Hoje **toda coluna contratual desse inventário está no default de
propósito** (`dpa=false`, `subprocessors=0`, `score=50`, o resto nulo), porque o
runbook decidiu que confirmação de contrato se faz na tela, não no seed. Este
documento é a evidência para essa confirmação, não o ato dela. Fonte primária
significa o site do próprio fornecedor; onde a página bloqueou leitura
automatizada, isso está dito no bloco, e nenhum prazo de retenção foi escrito
aqui sem documento que o sustente.

## 1. Quadro-resumo

| Código | Fornecedor | DPA | Região | Retenção declarada | Subprocessadores | Transferência | Verificado |
|---|---|---|---|---|---|---|---|
| V-01 | Anthropic | embutido | não declarada | não confirmada p/ API | [trust](https://trust.anthropic.com/subprocessors) | SCCs | 2026-09-05 |
| V-02 | OpenAI | embutido | não declarada | ZDR sob aprovação | [lista](https://openai.com/policies/sub-processor-list/) | não confirmado | 2026-09-05 |
| V-03 | Google (Gemini API) | embutido | não declarada | ZDR documentado | [lista GCP](https://cloud.google.com/terms/subprocessors) | não confirmado | 2026-09-05 |
| V-04 | Langfuse (ClickHouse) | a assinar | US, EU, JP, HIPAA | não confirmada | [lista](https://clickhouse.com/legal/agreements/langfuse-subprocessors) | SCCs + DPF | 2026-09-05 |
| V-05 | Neon (Databricks) | embutido | região do cliente | não confirmada | [lista](https://www.databricks.com/legal/databricks-subprocessors) | não confirmado | 2026-09-05 |
| V-06 | Vercel | embutido | AWS/Azure/GCP | não confirmada | [trust](https://security.vercel.com/) | SCCs + UK IDTA | 2026-09-05 |
| V-07 | Upstash | a assinar \* | não confirmada | não confirmada | [PDF](https://upstash.com/trust/subprocessors.pdf) | não confirmado \* | 2026-09-05 |
| V-08 | Sentry | a assinar | US ou EU | não confirmada | [lista](https://sentry.io/legal/subprocessors/) | SCCs + DPF | 2026-09-05 |
| V-09 | Liveblocks | embutido | não declarada | não confirmada | [lista](https://liveblocks.io/subprocessors) | SCCs + UK | 2026-09-05 |
| V-10 | Resend | embutido | EUA | não confirmada | [lista](https://resend.com/legal/subprocessors) | SCCs + UK | 2026-09-05 |
| V-11 | Fireflies | a assinar | não declarada | 0 dias com fornecedores | [trust](https://trust.fireflies.ai/subprocessors) | não confirmado | 2026-09-05 |
| V-12 | PostHog | a assinar | EUA ou Alemanha | não confirmada | [lista](https://posthog.com/subprocessors) | SCCs + DPF | 2026-09-05 |
| V-13 | Arcjet | não encontrado | multi-região | 30 dias | [trust](https://trust.arcjet.com/subprocessors) | não encontrado | 2026-09-05 |
| V-14 | Inngest | não encontrado | não declarada | não confirmada | [trust](https://trust.inngest.com/subprocessors) | não encontrado | 2026-09-05 |
| V-15 | Svix | não encontrado | região do cliente | não confirmada | [lista](https://www.svix.com/legal/subprocessors/) | não encontrado | 2026-09-05 |
| V-16 | Knock | a assinar | não declarada | sem prazo | [lista](https://knock.app/legal/subprocessors) | SCCs + UK IDTA | 2026-09-05 |
| V-17 | BaseHub | não encontrado | não declarada | não confirmada | não encontrado | não encontrado | 2026-09-05 |
| V-18 | Stripe | embutido | global, EUA | não confirmada | [lista](https://stripe.com/br/legal/service-providers) | SCCs + DPF | 2026-09-05 |
| V-19 | Vercel AI Gateway (`typesafe-ai/jev`) | não confirmada | não declarada | ZDR pedido pelo cliente, não confirmado pelo fornecedor | não encontrado | não confirmado | 2026-09-23 |

Oito embutidos, seis a assinar, quatro sem documento público, um novo sem
classificação (V-19).

## 2. Fornecedor a fornecedor

### V-01 · Anthropic — modelo de linguagem

Os [termos comerciais](https://www.anthropic.com/legal/commercial-terms) (2026)
citam o "Anthropic Data Processing Addendum", "which is incorporated into these
Terms by reference". A central de ajuda confirma o mesmo em outras palavras: o
DPA com cláusulas-padrão "is automatically incorporated into our" termos
comerciais ([support.claude.com,
2026](https://support.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa)).
Lista de subprocessadores em [trust.anthropic.com](https://trust.anthropic.com/subprocessors),
portal dinâmico — a data de atualização não pôde ser lida daqui.

A página pública de retenção que consegui ler
([privacy.claude.com](https://privacy.claude.com/en/articles/10023548-how-long-do-you-store-my-data),
2026) é a dos produtos de consumo e diz explicitamente que os produtos
comerciais e a API têm política própria. Retenção da API, portanto, **não
confirmada** — e é exatamente o que o `notes` do V-01 manda confirmar. Preenche
`dpa`, `subprocessors`, `region`. Ação pendente: **nenhuma** para o DPA; a
confirmação de retenção zero é conversa comercial, não assinatura.

### V-02 · OpenAI — modelo de linguagem

O [DPA](https://openai.com/policies/data-processing-addendum/) (versão 010126)
vale por aceite de uso: "By clicking 'I agree,' accepting the Order Form, or
using the Services, Customer agrees to this Agreement". A página bloqueia
leitura automatizada (HTTP 403); o texto veio da busca no próprio domínio e do
[PDF oficial](https://cdn.openai.com/pdf/openai-data-processing-addendum.pdf).

Uso para treino: dado enviado à API "is not used to train or improve OpenAI
models" desde 1 de março de 2023. Retenção zero e monitoramento de abuso
modificado existem, mas **sujeitos a aprovação prévia da OpenAI** e aceite de
requisitos adicionais — não são o padrão
([developers.openai.com, 2026](https://developers.openai.com/api/docs/guides/your-data)).
O prazo padrão de retenção dos logs de abuso não estava no texto que li.

Preenche `dpa`, `retention` (parcial). Ação pendente: **nenhuma** para o DPA;
decidir se `gpt-4o-mini` em `packages/ai/lib/models.ts` é caminho ativo — se
for, pedir ZDR; se for herança do template, remover.

### V-03 · Google — modelo de linguagem

Achado material. O roteador usa `createGoogleGenerativeAI`
(`packages/ai/lib/router.ts`), que é a **Gemini Developer API**, não a Vertex.
Os termos aplicáveis são os [Gemini API Additional Terms of
Service](https://ai.google.dev/gemini-api/terms) (última atualização 2026-04-28),
que remetem a um "Data Processing Addendum for Products Where Google is a Data
Processor" — logo, embutido. O [Cloud Data Processing
Addendum](https://cloud.google.com/terms/data-processing-addendum) (2026), com
seus compromissos de localização e a lista em
[subprocessors](https://cloud.google.com/terms/subprocessors), cobre o Google
Cloud e **não é o instrumento desta chave**.

A distinção decide o risco: em Paid Services o Google não usa prompts nem
respostas para melhorar produtos; em Unpaid Services usa, e revisores humanos
leem entrada e saída. Retenção zero é documentada em
[ai.google.dev/gemini-api/docs/zdr](https://ai.google.dev/gemini-api/docs/zdr).
Preenche `dpa`, `retention`, `maxClass`. Ação pendente: **confirmar que a chave
é de plano pago**. Se não for, nenhum dado de cliente pode passar por essa rota.

### V-04 · Langfuse — observabilidade de LLM

Achado material. A Langfuse foi absorvida pela ClickHouse: as páginas legais
redirecionam para lá. O instrumento é o [ClickHouse Customer Data Processing
Addendum](https://clickhouse.com/legal/agreements/data-processing-addendum)
(2026), com SCCs 2021/914, Data Privacy Framework e autorização geral de
subprocessadores. A [lista específica do Langfuse
Cloud](https://clickhouse.com/legal/agreements/langfuse-subprocessors) é de
2026. Regiões do SaaS: EUA, UE, Japão e uma região HIPAA
([langfuse.com/security](https://langfuse.com/security), 2026); self-hosted, em
qualquer lugar. Existe ainda um [PDF autônomo de
2025-07-10](https://static.langfuse.com/legal/2025-07-10-Public-Langfuse%20DPA.pdf).
Não localizei cláusula de incorporação automática — daí "a assinar".
Preenche `dpa`, `region`, `subprocessors`. Ação pendente: **assinar** (e decidir
com qual entidade se contrata, Langfuse ou ClickHouse). O `notes` do V-04 já
carrega a restrição que importa mais que o DPA: nunca ligar
`LANGFUSE_CAPTURE_CONTENT` em ambiente com dado de cliente.

### V-05 · Neon / PostgreSQL — banco de dados

Achado material. A Neon é da Databricks. O [Neon Platform Services Product
Specific Schedule](https://neon.com/platform-terms) (2026) se apoia na
[Databricks MCSA](https://www.databricks.com/legal/mcsa) e aponta a
[lista de subprocessadores](https://www.databricks.com/legal/databricks-subprocessors)
(2026), acrescentando a Grafana Labs (EUA) para infraestrutura. O processamento
segue a região selecionada pelo cliente. Há também um [PDF
assinável](https://neon.com/pdf/DPA.pdf) para quem precisa de via própria.
Preenche `dpa`, `region`, `subprocessors`. Ação pendente: **nenhuma** para o
DPA. Fica de pé o que o `notes` do V-05 diz: o isolamento entre tenants hoje é
de aplicação (ADR-0012), e isso é risco de arquitetura, não de contrato.

### V-06 · Vercel — hospedagem e execução

O [DPA](https://vercel.com/legal/dpa) (2026) vale "as of the effective date of
such Agreement". As cláusulas-padrão de 2021 e o UK IDTA são dados por
celebrados, e ambas as partes "deemed to have signed" as SCCs pelo simples ato
de contratar. Dados hospedados em data centers da AWS, Azure e GCP, com backups
redundantes em múltiplas zonas, cifrados em trânsito e em repouso.

A lista de subprocessadores (`vercel.com/legal/sub-processors`) redireciona para
o [Trust Center](https://security.vercel.com/), que exige sessão — não consegui
ler a data de atualização. Preenche `dpa`, `region`. Ação pendente: **nenhuma**.

### V-07 · Upstash — cache e rate limit

O DPA existe como PDF em
[upstash.com/trust/dpa.pdf](https://upstash.com/trust/dpa.pdf), com "Last Update
Date: April, 2025"; a lista de subprocessadores em
[upstash.com/trust/subprocessors.pdf](https://upstash.com/trust/subprocessors.pdf)
e no [trust center](https://trust.upstash.com/). Os PDFs não têm camada de texto
extraível — não pude ler mecanismo de transferência, retenção nem se o
documento se incorpora sozinho aos termos; classificação provisória.
Preenche `dpa`, `subprocessors`. Ação pendente: **abrir os PDFs à mão** e, se
não houver incorporação automática, assinar.

### V-08 · Sentry — observabilidade de erro

O [DPA 5.1.0, de 29 de maio de 2024](https://sentry.io/legal/dpa/), é celebrado
"by the party that electronically accepts or otherwise agrees or opts-in to this
DPA" e é "effective as of the date electronically agreed and accepted by you".
Não é automático: alguém precisa aceitar. Define SCCs 2021/914 e o Data Privacy
Framework. Armazenamento nos EUA "and any other country in which we or our
Subprocessors maintain data processing operations".

Residência é escolhida na criação da organização, EUA ou UE
([docs.sentry.io](https://docs.sentry.io/organization/data-storage-location/),
2026). Subprocessadores na versão 2.3.0, "Last Updated: June 1, 2026"
([sentry.io/legal/subprocessors](https://sentry.io/legal/subprocessors/)).
Preenche `dpa`, `region`, `subprocessors`. Ação pendente: **aceitar no portal**.
Segue valendo o `notes` do V-08: confirmar a política de scrubbing, porque
stack trace carrega dado incidental.

### V-09 · Liveblocks — colaboração em tempo real

O [DPA](https://liveblocks.io/dpa) "is incorporated into, and is subject to the
terms and conditions of" o contrato, e vale por todo o prazo dele. As SCCs da
UE e o UK Addendum entram por referência. Subprocessadores em
[liveblocks.io/subprocessors](https://liveblocks.io/subprocessors) — a página
não declara data de atualização. Preenche `dpa`, `subprocessors`. Ação
pendente: **nenhuma** — o risco do V-09 é de conteúdo em trânsito, não de
instrumento contratual.

### V-10 · Resend — e-mail transacional

O [DPA](https://resend.com/legal/dpa) "shall become legally binding upon
Customer entering into the Agreement or upon execution of this Addendum" — vale
pelo contrato. As SCCs da UE são dadas por celebradas e assinadas; o UK Addendum
entra por referência. Objeção a novo subprocessador em 14 dias.
[Lista](https://resend.com/legal/subprocessors): AWS e demais fornecedores, todos
nos EUA; a página não declara data. Preenche `dpa`, `subprocessors`, `region`.
Ação pendente: **nenhuma**.

### V-11 · Fireflies — transcrição de reunião

Maior risco do inventário e o único cujo DPA é um fluxo de assinatura explícito:
[fireflies.ai/dpa](https://fireflies.ai/dpa) pede a contraparte legal e conduz
à assinatura. A [política de
privacidade](https://fireflies.ai/privacy-policy) (Last Updated: 6 de março de
2026) declara que o conteúdo de reunião não é armazenado por fornecedor terceiro
após o processamento, não é acessado depois e não é usado para treinar modelos,
internos ou externos. A [página de segurança](https://fireflies.ai/security)
(2026) fala em política de retenção de 0 dias com fornecedores e parceiros, e
retenção customizada nos planos superiores. Subprocessadores em
[trust.fireflies.ai](https://trust.fireflies.ai/subprocessors), portal dinâmico.
Preenche `dpa`, `retention`, `subprocessors`. Ação pendente: **assinar** — e,
antes de aprovar o fornecedor, resolver o consentimento de gravação, que é o que
o `notes` do V-11 exige e o que
[`consentimento-de-gravacao.md`](./consentimento-de-gravacao.md) trata.

### V-12 · PostHog — analytics de produto

DPA self-serve: gera-se dentro da própria organização PostHog, já
contra-assinado, chega por PandaDoc e "é efetivo no momento em que você assina",
em qualquer plano, inclusive o gratuito ([posthog.com/dpa](https://posthog.com/dpa),
2026). Transferência por SCCs da UE, IDTA do Reino Unido e adaptação suíça, com
autocertificação nos três ramos do Data Privacy Framework. Subprocessadores em
[posthog.com/subprocessors](https://posthog.com/subprocessors), "Last updated:
June 12, 2026", com uma lista separada de subprocessadores de IA que só se
aplica se as funcionalidades de IA estiverem ligadas. Região: EUA ou Alemanha.

Preenche `dpa`, `region`, `subprocessors`. Ação pendente: **assinar** — são
poucos minutos e ninguém precisa aprovar do lado deles. O `notes` do V-12 pede
ainda confirmar o que vai em cada evento.

### V-13 · Arcjet — segurança de borda

Nenhum DPA público: `arcjet.com/legal/dpa` responde 404 e o
[trust center](https://trust.arcjet.com/subprocessors) é portal dinâmico. Os
[docs de privacidade](https://docs.arcjet.com/privacy) (2026) são específicos:
o corpo da requisição não é enviado à API; vão IP, cabeçalhos, características
customizadas quando usadas e o e-mail quando há validação de e-mail. **Retenção
de 30 dias** para análise histórica, com agregados mantidos por mais tempo. A
API opera em várias regiões, e processar numa região específica é add-on pago.

Preenche `retention`, `region`. Ação pendente: **pedir o DPA** ao fornecedor.

### V-14 · Inngest — execução de jobs

Nenhum DPA público: `inngest.com/legal/dpa` e `/legal/terms` respondem 404. A
[página de segurança](https://www.inngest.com/security) (2026) declara programa
de segurança sob os critérios SOC 2 e conformidade SOC 2 Type II. A lista de
subprocessadores em [trust.inngest.com](https://trust.inngest.com/subprocessors)
não abriu para leitura automatizada.

Ação pendente: **pedir o DPA**. Pesa mais do que o tier sugeriria: o `notes` do
V-14 lembra que o Inngest orquestra o V-11 e herda o risco dele.

### V-15 · Svix — webhooks

Nenhum DPA público (`svix.com/legal/dpa` → 404), mas a
[lista de subprocessadores](https://www.svix.com/legal/subprocessors/) (2026) é
a mais clara do inventário: separa Customer Content de Account Data e diz que
**o único subprocessador com acesso ao Customer Content é a AWS**, com o
conteúdo "armazenado e processado exclusivamente na região AWS escolhida pelo
cliente", sem sair dela. A [página de
segurança](https://www.svix.com/security/) (2026) cita SOC 2 Type II anual,
atestações HIPAA e PCI-DSS, e regiões nos EUA, União Europeia, Austrália e
Canadá.

Preenche `region`, `subprocessors`. Ação pendente: **confirmar se está em uso**
antes de pedir DPA — o `notes` do V-15 registra que três arquivos importam o
pacote, o que não é o mesmo que estar em produção.

### V-16 · Knock — notificações

O [DPA](https://knock.app/legal/data-processing-addendum) tem "Last updated:
August 10, 2023" e pressupõe execução: os anexos "shall automatically be deemed
executed when the DPA is executed by Customer". SCCs 2021/914 e IDTA do Reino
Unido de 21 de março de 2022.
[Subprocessadores](https://knock.app/legal/subprocessors) sem data declarada.
Retenção "pelo tempo necessário", sem prazo — nada a registrar em `retention`.

Ação pendente: **confirmar se está em uso**. O `notes` do V-16 aponta um único
arquivo importando, provável herança do Next Forge. Se não estiver, o DPA de
2023 não precisa ser assinado — o fornecedor precisa sair do inventário.

### V-17 · BaseHub — CMS do site

Não encontrado. `basehub.com/legal/terms` e `/legal/privacy` respondem 200, mas
servem uma casca renderizada por JavaScript: o conteúdo não chega ao HTML e não
há documento legível por fonte primária. Nenhum DPA público localizado.

Ação pendente: **pedir o DPA**, com pouca urgência — o `notes` do V-17 registra
que o site já tirou `/legal` do CMS de propósito, então o BaseHub não guarda o
que mais importaria.

### V-18 · Stripe — pagamentos

O [Data Processing Agreement](https://stripe.com/en-br/legal/dpa), "Last updated:
November 18, 2025", é incorporado ao contrato de serviços. Transferências
globais, em particular para a Stripe, LLC nos EUA e afiliadas em outras
jurisdições; SCCs 2021/914 Módulos 1 e 2 e Data Privacy Framework definidos.
Subprocessadores e afiliadas em
[stripe.com/legal/service-providers](https://stripe.com/br/legal/service-providers).

Preenche `dpa`, `region`. Ação pendente: **confirmar se está ativo**, como pede
o `notes` do V-18.

### V-19 · Vercel AI Gateway (`typesafe-ai/jev`) — triagem automática de commits

Achado em 2026-09-23 ao avaliar `.maestri/jev.mjs`: rotina horária que manda
subject, arquivos e diff de commits ao endpoint
`https://ai-gateway.vercel.sh/v4/ai/evaluation-model`, modelo
`typesafe-ai/jev`, com `providerOptions.gateway.zeroDataRetention: true` na
requisição. Diferente do V-06 (Vercel como hospedagem/execução, DPA embutido
pelo contrato comercial), este é um produto separado (AI Gateway) roteando
para um alias de modelo (`typesafe-ai`) cuja identidade — produto próprio da
Vercel ou repasse a terceiro — não foi possível confirmar por fonte primária.
O ZDR é um campo enviado pelo cliente na chamada, não uma cláusula contratual
verificada; sem confirmação de que o Gateway ou o provedor por trás do alias
honra esse campo, ele conta como pedido, não como garantia. Ver parecer
completo em
[`2026-09-23-parecer-triagem-jev.md`](2026-09-23-parecer-triagem-jev.md).

Não preenche `dpa`, `region` nem `subprocessors` — nenhum dos três está
confirmado. Ação pendente: **identificar o operador real por trás de
`typesafe-ai`** e confirmar se o AI Gateway honra `zeroDataRetention`
contratualmente, não só como campo de requisição. Mitigação de dado pessoal
(exclusão de `packages/database/scripts/` do diff enviado) já aplicada em
`.maestri/jev.mjs`, fora do escopo deste dossiê de fornecedores.

## 3. Ações consolidadas

O RACI do [playbook de vendas](../comercial/playbook-de-vendas.md) §4 tem a
estrutura montada e **os nomes em branco** — preencher é decisão de quem dirige
a empresa. A coluna abaixo nomeia o papel, não a pessoa; quando os nomes
entrarem no playbook, esta tabela passa a ter dono de verdade.

| Fornecedor | Ação | Dono (papel, Charter) | Bloqueia venda? |
|---|---|---|---|
| V-02 OpenAI | decidir se é rota ativa; se for, pedir ZDR | Responsável pela entrega | não |
| V-03 Google | confirmar que a chave é de plano pago | Responsável pela entrega | **sim** |
| V-04 Langfuse | assinar (definir entidade contratante) | Auditor / revisor | não |
| V-07 Upstash | ler o PDF do DPA; assinar se não for automático | Auditor / revisor | não |
| V-08 Sentry | aceitar o DPA no portal | Dono do SLA | não |
| V-11 Fireflies | assinar, depois de resolver consentimento | Dono do roadmap | **sim** |
| V-12 PostHog | gerar e assinar (self-serve) | Auditor / revisor | não |
| V-13 Arcjet | pedir DPA | Auditor / revisor | não |
| V-14 Inngest | pedir DPA (orquestra o V-11) | Dono do SLA | **sim** |
| V-15 Svix | confirmar uso; pedir DPA se ativo | Responsável pela entrega | não |
| V-16 Knock | confirmar uso; remover do inventário se não | Responsável pela entrega | não |
| V-17 BaseHub | pedir DPA | Auditor / revisor | não |
| V-18 Stripe | confirmar se está ativo | Dono do roadmap | não |
| V-19 Vercel AI Gateway | identificar operador de `typesafe-ai`; confirmar ZDR contratual | Compliance / DPO | não |

Três bloqueiam venda. O V-03 porque, em plano não pago, a Gemini API usa o
conteúdo submetido para melhorar produtos e revisores humanos leem entrada e
saída — nenhum cliente assina isso. O V-11 e o V-14 porque transcrição de
reunião de cliente é o dado mais sensível do inventário e o Inngest é o caminho
por onde ele passa. Anthropic, Neon, Vercel, Liveblocks e Resend não têm ação:
é a vantagem de fornecedor que incorpora DPA por referência.

## 4. O que não achei

- **V-01 Anthropic** — prazo de retenção da API. A página pública de retenção
  cobre os produtos de consumo e diz que os comerciais têm política separada,
  que não é pública. Data de atualização da lista de subprocessadores também
  não: o trust center é portal dinâmico.
- **V-02 OpenAI** — o prazo padrão de retenção dos logs de monitoramento de
  abuso, e o mecanismo de transferência declarado. As páginas de política e de
  subprocessadores retornam HTTP 403 a leitura automatizada; o PDF do DPA não
  tem camada de texto extraível.
- **V-03 Google** — o texto integral dos termos da Gemini API (a página entra em
  laço de redirecionamento). A cláusula de treino em plano pago e a de plano não
  pago vieram da busca no próprio domínio, não da leitura direta.
- **V-04 Langfuse** — se o DPA da ClickHouse se incorpora sozinho ao contrato ou
  exige assinatura. Classificado como "a assinar" por ausência de cláusula.
- **V-05 Neon** — mecanismo de transferência declarado, que está na MCSA da
  Databricks e não no schedule da Neon.
- **V-06 Vercel** — a lista de subprocessadores e sua data: o link redireciona
  para um trust center com sessão obrigatória.
- **V-07 Upstash** — praticamente tudo além da data de abril de 2025: os três
  PDFs (DPA, subprocessadores, privacidade) não têm camada de texto.
- **V-08 Sentry** — o prazo de retenção. O DPA tem a seção, mas o período não
  estava no texto lido.
- **V-09 Liveblocks** — região de processamento, retenção e data da lista de
  subprocessadores; nenhuma das três é declarada nas páginas públicas.
- **V-10 Resend** — data de atualização da lista de subprocessadores.
- **V-11 Fireflies** — a lista de subprocessadores (portal dinâmico) e a
  retenção do conteúdo dentro do próprio Fireflies. Os 0 dias declarados são
  com fornecedores e parceiros, não a retenção do serviço.
- **V-13 Arcjet**, **V-14 Inngest** — DPA público e mecanismo de transferência.
  Os trust centers de ambos são portais dinâmicos.
- **V-15 Svix** — DPA público e mecanismo de transferência.
- **V-16 Knock** — data da lista de subprocessadores e região de processamento.
- **V-17 BaseHub** — tudo. As páginas legais servem casca vazia sem JavaScript.
- **V-18 Stripe** — retenção declarada e data da lista de subprocessadores.
