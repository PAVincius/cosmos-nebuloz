# Parecer de Compliance — Fluxo de respondente do Meridian (dogfood → produção)

- **Data:** 2026-09-24
- **Solicitante:** Morgana, a mando do CEO (gate de PR: `.maestri/knowledge/compartilhado/gate-de-pr.md`, "Coleta dado pessoal? Parecer da Compliance antes de ir ao ar")
- **Objeto:** liberação do fluxo de coleta multi-respondente do Meridian (consultor atribui respondente por nome/cargo/e-mail; respondente anônimo responde por link e anexa evidência) para ir a produção no dogfood, e condições para uso com cliente externo depois
- **Autor:** Compliance / DPO

## Veredito

**LIBERADO COM CONDIÇÕES para o dogfood interno** (titulares: fundador + agentes) — uma condição rápida, sem custo, antes de ir ao ar.

**BLOQUEADO para uso com cliente externo** (respondentes que sejam funcionários reais de terceiros) até as 5 condições da seção 4.

## 1. O que o fluxo faz (lido no código)

- `assignRespondent` (`apps/app/app/(meridian)/actions/collection.ts:37-113`) — um consultor do cliente cadastra `MeridianRespondent` com `name`, `role`, `email` (schema `AssignSchema`, linhas 27-33), gera um token de uso único (`issueToken`), guarda só o hash (`tokenHash`) e monta o link `/meridian-responder/<token>`.
- `apps/app/app/meridian-responder/[token]/page.tsx` é a única rota do produto **fora** do guard de sessão de tenant (comentário nas linhas 8-16 do próprio arquivo) — o respondente não tem conta, o `tenantId` sai do token.
- `loadRespondent` (`apps/app/app/(meridian)/actions/respondent.ts:96-108`) resolve o token; token inexistente, expirado ou revogado devolvem o mesmo erro genérico ("Link inválido ou expirado") — decisão de design correta contra enumeração.
- `attachEvidence` (`respondent.ts:280-330`) sobe arquivo até 10 MB (`MAX_EVIDENCE_BYTES`, linha 279) para o bucket privado `meridian-evidence` (`packages/storage/src/index.ts:15`), caminho `tenantId/assessmentId/uuid`. Banco guarda só metadado (`fileName`, `storagePath`).
- `requestEvidenceUrl` (`apps/app/app/(meridian)/actions/report.ts:264-300`) — leitura de evidência por um usuário autenticado do cliente **grava auditoria antes de emitir a URL assinada** (comentário nas linhas 260-262: "auditoria de acesso concedido, não de byte entregue"), atrás de `requireMeridianPermissionContext("evidence.read")`. Essa parte da pergunta do pedido está confirmada e correta.

## 2. Pergunta 1 — base legal e aviso na tela do link são suficientes?

**Base legal: existe caminho, mas não está fechado por decisão formal.** `docs/compliance/operadora-controladora.md` (documento já existente, não escrito hoje) já mapeou exatamente este fluxo (§1.1): cliente decide finalidade (diagnosticar a própria organização, quem convidar, prazo) — **cliente controlador, Nebuloz operadora**, base legal é a do cliente. Essa é a leitura correta e eu confirmo. Mas a §5 desse mesmo documento lista 8 perguntas em aberto para quem dirige a empresa e para o jurídico — a **pergunta 1** ("A Nebuloz assume o enquadramento de operadora nos dois fluxos?") ainda não tem "sim" registrado em lugar nenhum que eu tenha achado, e sem esse "sim" as cláusulas C1-C7 (que dizem, no contrato, que o cliente é controlador e o canal do titular sem conta existe) não entraram no `dpa-modelo.md`. Não bloqueia o dogfood — ver seção 3 — mas é o que falta para dizer "suficiente" sem ressalva no uso externo.

**Aviso na tela: não existe.** Busquei por texto de LGPD/privacidade/consentimento/tratamento de dado em `apps/app/components/meridian/respondent-form.tsx` (266 linhas) e em `apps/app/app/meridian-responder/[token]/page.tsx` (91 linhas) — zero ocorrências. A página de erro (link inválido) tem texto; a página de resposta não tem nenhum aviso sobre quem coletou o dado, para quê, por quanto tempo, nem para onde reclamar. E o `/legal/privacy` publicado (`apps/web/app/[locale]/legal/privacy/`, dicionário `packages/internationalization/dictionaries/pt.json`) diz explicitamente, no primeiro parágrafo: *"Esta política cobre o nebuloz.ai. Não cobre os produtos em si depois que você é cliente"* — ou seja, mesmo esse texto **não vale** para quem responde a bateria pelo link. O texto pronto pra isso já existe, redigido, em `operadora-controladora.md` §4 ("Se seus dados chegaram até nós por uma organização...") — só não foi colado em lugar nenhum do produto. Isso é insuficiente pelo art. 9º da LGPD (direito à informação clara sobre o tratamento), **independente de quem for o titular** — não há exceção "é o próprio dono da empresa" na lei.

## 3. Pergunta 3 primeiro (define o que a pergunta 2 precisa) — bloqueia o dogfood interno ou só o cliente externo?

**Só o cliente externo.** No dogfood, os titulares são o fundador (que é, ele mesmo, quem decide rodar o diagnóstico — o controlador e o titular coincidem na mesma pessoa) e "agentes" (perfis sintéticos de teste — `role`/`email` de personas simuladas via `seed-meridian.ts`, sem pessoa natural real por trás na maioria dos casos; onde houver e-mail real de colega, como em `packages/database/scripts/2026-09-diagnostico-nebuloz.sql:124-130`, ver a ressalva abaixo). Não há titular externo, terceiro, sem poder de decisão sobre o próprio dado nesse cenário — o risco central que a LGPD protege (assimetria entre quem coleta e quem é coletado) não está presente do jeito que estará com um cliente de verdade.

**Uma ressalva que não é hipotética, achada agora:** se o dogfood reusar os dados reais do `2026-09-diagnostico-nebuloz.sql` (nome e e-mail pessoal do fundador, `vinicius.pratesaraujo@gmail.com` — já achei isso no parecer de 2026-09-23 sobre outra rotina) como respondente de teste, o titular é uma pessoa real identificável fora de contexto de teste puramente sintético; ainda assim é o próprio fundador optando por participar do próprio dogfood — segue liberado, mas o aviso mínimo da condição 1 abaixo deve estar de pé antes, já que ele é o primeiro titular real a passar pelo fluxo.

## 4. Pergunta 2 — retenção da evidência e do e-mail; o que exigir antes de cliente externo

**E-mail/nome do respondente:** cobertos por DSAR — `docs/compliance/lgpd-ropa-e-lacunas.md:156` confirma que `MeridianRespondent` está na cobertura de eliminação (`MeridianResponse` preservado por cascata, mas nome/e-mail somem e token é invalidado). Funciona, mas só quando **o cliente** aciona — não há canal para o respondente externo pedir diretamente (mesma lacuna do §4 do `lgpd-ropa-e-lacunas.md`, linhas 128-134), porque ele não tem conta.

**Evidência (arquivo no bucket): não coberta, e o próprio código diz isso.** `apps/app/lib/inngest/lgpd-dsr.ts:218-230` — comentário do autor: o job de eliminação anonimiza o `fileName` no banco, mas "o objeto em si, em `storagePath`, vive no bucket privado `meridian-evidence`, fora do banco e fora do alcance deste job (...) lacuna real, registrada aqui em vez de fingida como coberta". Isso bate com `lgpd-ropa-e-lacunas.md:176` e com o P2 do security review do Vigia em `docs/qualidade/dogfood/meridian/atrito.md:60` ("Bucket de evidência criado sem política de lifecycle (...) evidência (...) fica armazenada indefinidamente, sem uma regra declarada"). Três fontes independentes apontam o mesmo buraco — não é achado novo meu, é confirmação de um gap já documentado e ainda em backlog.

**O que exigir antes de abrir para cliente externo** (nenhum item é hipotético — todos já têm dono e estado no repo):

1. **Aviso mínimo na tela do link** — publicar, em `respondent-form.tsx` ou na página do token, o texto já redigido em `operadora-controladora.md` §4 (versão curta: quem convidou, para quê, prazo, e que a Nebuloz é operadora, não controladora, dos dados ali coletados). Sem custo, sem depender de decisão jurídica pendente — é texto estático. **Também recomendado para o dogfood, não só para o externo** (seção 3).
2. **Rotina de eliminação do objeto no bucket** (`packages/storage`) que complemente o `lgpd-dsr.ts` — hoje o DSAR "funciona" só no banco; para valer o direito de eliminação prometido a um titular externo real, o arquivo tem que sumir também. Dono já registrado: Bussola, backlog.
3. **Política de lifecycle/retenção do bucket `meridian-evidence`** declarada — mesmo que seja "retém por N meses após o fechamento do assessment, depois expira" — hoje não existe regra nenhuma (`packages/storage/src/index.ts:21`, P2 do Vigia). Sem isso, evidência de terceiro fica armazenada para sempre por padrão, o que não sobrevive a uma auditoria de proporcionalidade (art. 6º, III, LGPD).
4. **Decisão da pergunta 1 de `operadora-controladora.md` §5 tomada pelo CEO**, e as cláusulas C1-C7 incorporadas ao `dpa-modelo.md`/contrato do cliente — sem isso, "cliente controlador, Nebuloz operadora" é a leitura técnica correta mas não uma posição contratual assumida; um cliente ou titular que questionar hoje não encontra isso escrito em lugar nenhum que valha como acordo.
5. **Rate limit no lookup de token** (`respondent.ts:96`, P2 do Vigia em `atrito.md:48`) — hoje nada impede tentativa repetida de adivinhar um hash válido. Com titular externo real por trás do link, isso deixa de ser só risco de segurança e vira risco de acesso não autorizado a dado pessoal (art. 46 LGPD, medida técnica de segurança) — peço ao Vigia para subir a prioridade desse item especificamente quando a decisão de abrir para cliente externo se aproximar.

Não exijo essas 5 para o dogfood — só a 1, e só porque é grátis e é a hora certa de criar o hábito.

## Decisões

- 2026-09-24 — Compliance/DPO libera o dogfood interno com a condição 1 (aviso mínimo na tela); bloqueia uso com cliente externo até as condições 1-5 da seção 4, com donos já identificados (Bussola: 2 e 5; CEO/jurídico: 4; qualquer terminal: 1, é trivial).
- 2026-09-28 — Condição 2 (rotina de eliminação do objeto no bucket) entregue: `processErasureRequest` (`lgpd-dsr.ts`) chama `deleteObjects` sobre o `storagePath` da evidência do respondente eliminado por DSAR, além de anonimizar o metadado.
- 2026-09-28 — Condição 3 (política de retenção do bucket `meridian-evidence`): **CEO decide opção A — 90 dias após o fechamento do assessment** (das três trazidas em `docs/qualidade/dogfood/meridian/atrito.md:60`). Implementado o mesmo dia: `apps/app/lib/inngest/meridian-evidence-retention.ts`, cron diário, elimina o objeto e marca `storagePath` (registro em `MeridianEvidence` preservado, mesma lógica do DSAR). Condições 2 e 3 da seção 4 fechadas; seguem abertas 4 (decisão operadora/controladora) e 5 (rate limit — entregue em `respondent.ts`, atrito.md:48, mas ainda listada aqui como item a revisitar antes de cliente externo por decisão da própria Compliance).
