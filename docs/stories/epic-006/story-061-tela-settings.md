# Story 061 — Tela Settings (workspace, RBAC, SSO, auditoria, SAFe e plano)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** LEAN_AGILE_LEADERSHIP / governança do workspace · **Nível:** Portfolio
**PRD:** §3.8 SSO (`docs/PRD-v1.0.md:1974`), §4 planos (`docs/PRD-v1.0.md:1441`),
matriz de permissão (`docs/PRD-v1.0.md:1846`)
**SRD:** NFR de auditoria (`docs/srd-epic-007.md:378`)

> Por que uma história para a tela: Settings é a única superfície onde uma pessoa muda quem pode
> o quê (RBAC), como se autentica (SSO) e o que a organização consegue provar depois (auditoria).
> As três coisas são governança, não preferência — e a tela precisa fechar para quem não tem o
> papel, não só abrir para quem tem. Nenhum critério aqui é inventado: cada AC aponta para um UC
> ou AC do PRD, ou para a NFR de trilha de auditoria do SRD.

---

## Jornada do usuário

O Admin abre **Plataforma → Settings** em três momentos diferentes:

1. **Entrou gente nova.** Convida, troca papel, remove — e o sistema não deixa remover o último
   ADMIN nem o próprio usuário se remover, porque um workspace sem administrador não tem como
   voltar a ter um.
2. **O time de segurança do cliente perguntou.** Ele mostra a política (2FA, tolerância, IPs) e o
   estado do SSO. Nenhum certificado ou metadado de IdP aparece na tela — nem mascarado.
3. **Auditoria pediu prova.** Ele abre a trilha, que é imutável, escopada ao tenant e paginada.

E, num quarto momento, ele procura fatura — e não encontra, porque não existe. A aba de plano
mostra o tier real do workspace e diz onde falar com o comercial, em vez de desenhar assento,
fatura e cartão que este produto não tem.

---

## Acceptance Criteria

### AC-001: Abas de administração fecham para quem não é ADMIN — no servidor, não só na UI
_(PRD `docs/PRD-v1.0.md:1846` matriz de permissão: "Configure SSO" e trilha de auditoria só para
o papel administrativo)_

Given um papel diferente de `ADMIN`,
When `getSecurityTab` ou `getAuditTab` é chamado,
Then é recusado **antes** de qualquer leitura de linha de SSO, política ou log — esconder o botão
não é controle de acesso; e a tela também não oferece as abas.

### AC-002: SSO não pode ser ligado sem IdP configurado
_(PRD UC-18 passos 3–6: o dono só habilita a aplicação **depois** de entrar com metadados/
certificado do IdP e do teste passar; E-2: teste falhou → enforcement não é habilitado)_

Given um tenant sem nenhum dado de IdP gravado (`idpEntityId`, `idpMetadataUrl` e
`idpCertificate` todos vazios),
When um ADMIN tenta ligar o SSO,
Then é recusado com mensagem dizendo o que falta, e **nada** é gravado — ligar SSO sem IdP
publica um caminho de login que não autentica ninguém.

Given um tenant com pelo menos um desses campos preenchido,
When o SSO é ligado,
Then passa, e os campos sensíveis são regravados **sem alteração** (o `saveSSOConfig` subjacente
sobrescreve com `input.x || null`, então o toggle precisa devolvê-los intactos).

Given o SSO está ligado, em qualquer estado de configuração,
When um ADMIN desliga,
Then **sempre** passa — um tenant precisa poder desligar um SSO quebrado, e um guard que
impedisse isso trancaria todo mundo do lado de fora.

### AC-003: Nenhum campo sensível de SSO é lido para exibição
_(PRD §3.8; SRD NFR `docs/srd-epic-007.md:372`)_

Given qualquer papel,
When a aba de Segurança carrega,
Then só `enabled` e `updatedAt` são selecionados de `TenantSSOConfig` — certificado, entity id e
metadata url não são lidos nem para mascarar.

### AC-004: Trilha de auditoria é imutável, escopada e paginada
_(SRD NFR `docs/srd-epic-007.md:378`)_

Given um ADMIN abre a Auditoria,
Then a leitura é limitada a 25 por página, escopada ao tenant pela própria action madura, e o
nome do ator vem de um join com a lista real de membros — `userId` sem membro correspondente cai
para o id cru, e log sem `userId` aparece como "Sistema". Nada é inventado.

### AC-005: RBAC de membros não permite deixar o workspace sem dono
_(PRD `docs/PRD-v1.0.md:1846`)_

Given a última pessoa com papel `ADMIN`,
When seu papel é rebaixado ou ela é removida,
Then é recusado com motivo explícito, e a UI mostra o motivo em vez de falhar em silêncio.

### AC-006: Plano é leitura, e a ausência de faturamento é dita em voz alta
_(PRD §4 `docs/PRD-v1.0.md:1441`)_

Given qualquer tenant,
When a aba Plano & faturamento carrega,
Then mostra **apenas** o tier real de `Tenant.plan` e a indicação de como falar com o comercial
para mudar de plano — nenhuma fatura, nenhum assento, nenhum cartão, nem de exemplo. Não existe
modelo de cobrança neste schema, e desenhar um seria fabricar dado financeiro.

---

## Technical Notes

- **Sem migration.** Tudo que a tela lê e escreve já está modelado: `Tenant`, `TenantMember`,
  `TenantSSOConfig`, `TenantSecurityPolicy`, `AuditLog`, `ART`, `WsjfSettings`,
  `NotificationPreference`.
- **A guarda do AC-002 vive no adaptador, não no `saveSSOConfig`.** O `saveSSOConfig` maduro é
  usado também pelo editor de SSO completo, onde habilitar junto com os metadados na mesma
  submissão é legítimo; a recusa aqui é do toggle, que por construção não recebe metadado nenhum.
- **Gate de plano para SSO fica de fora.** O PRD (`:1441`) coloca SSO só no plano mais alto, mas o
  vocabulário do PRD (FREE/TEAM/BUSINESS/ENTERPRISE) não é o do schema (`SubscriptionPlan` =
  ORBIT/GALAXY/NEBULA/UNIVERSE), e a única ponte no repo é um rótulo de tela
  (`settings/workspace/components/plan-labels.ts`). Trancar login com base numa correspondência
  inferida não é decisão desta trilha — vira lacuna no nó.
- **A aba de faturamento continua balde C.** Não há `Invoice`, `Seat`, `Subscription` nem método
  de pagamento em lugar nenhum do schema. Fica leitura de `Tenant.plan` + contato comercial.

## Test Plan

- **Risco:** Alto — a tela governa autenticação e permissão.
- **Action** (`apps/app/__tests__/actions/settings-security.test.ts` e demais `settings-*`):
  ligar SSO sem IdP é recusado **sem gravar**; ligar com IdP regrava os sensíveis intactos;
  desligar passa sempre, mesmo sem IdP; `getSecurityTab`/`getAuditTab` **fecham** para não-ADMIN
  antes de qualquer leitura; auditoria capada em 25 e nome do ator resolvido de membro real.
- **Tela** (`apps/app/__tests__/screens/settings.test.tsx`): abas administrativas escondidas para
  não-ADMIN; campos read-only por papel; aba de plano sem fatura/assento/cartão e com o contato
  comercial. Asserção sobre conteúdo — sem snapshot.
- **Seed** (`packages/database/scripts/seed-cosmos.mts`): o tenant demo precisa de mais de um
  membro, com papéis diferentes, senão a aba de Membros abre com uma linha só e a matriz de RBAC
  não tem o que mostrar. SSO, política de segurança e trilha de auditoria **não** são semeados:
  são estado que só existe se alguém de fato configurou ou agiu — semear um AuditLog seria
  fabricar prova de auditoria, que é o oposto do que a aba existe para fazer.
