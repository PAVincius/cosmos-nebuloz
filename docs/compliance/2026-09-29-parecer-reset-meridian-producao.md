# Parecer de Compliance — Reset do Meridian em produção

- **Data:** 2026-09-29
- **Solicitante:** Morgana (noite autônoma do CEO)
- **Objeto:** `apps/app/scripts/sql/meridian-reset.sql` e `docs/runbooks/meridian-reset-producao.md`, worktree `wt-meridian`, commits `0b644132`, `a78be7f4`, `de0e25c3` (Vigia aprovou para produção). Decisão do CEO de 2026-09-28 23h, conforme o pedido da Morgana: apagar só dados Meridian, todos os tenants.
- **Autor:** Compliance / DPO
- **Método:** só leitura. Li o SQL e o runbook linha a linha, o schema (`meridian.prisma`), `_shared.ts` (escrita de auditoria) e os pareceres anteriores. **Não consultei produção** (sem credencial nesta função), então nada abaixo afirma estado de produção.

## Veredito

**OK com condições.** O reset em si melhora a posição de privacidade: elimina dado pessoal em vez de acumulá-lo, e o desenho do backup (fechado, com prazo, com dono) é o certo. Duas condições precisam estar cumpridas **antes do bloco 3**; três ajustes de texto no runbook e uma declaração no RoPA seguem junto.

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Backup no banco: base legal, prazo, PITR, RoPA | **OK com condições** (C2, C3, C4) |
| 2 | Bucket esvaziado sem backup | **OK** (uma exigência de registro, C5) |
| 3 | `AuditLog` fica com o que era de registros apagados | **Mantém**, mas o que fica é maior do que "entityId". Ver §3 |
| 4 | Cliente externo com dado no Meridian | **Não consigo afirmar que não há. Bloqueia até a checagem (C1).** Se houver, é do CEO e o reset para |

## Condições

**C1 — Checar quem é o dono do dado antes do bloco 3 (bloqueia).** O bloco 1 conta linhas por tabela; não diz de quem são. O reset é global, e o parecer de 24/09 (`2026-09-24-parecer-meridian-respondente.md`, §4) manteve o Meridian **bloqueado para cliente externo** enquanto a condição 4 (operadora × controladora) estiver aberta. Logo, pela regra, não deveria haver respondente de terceiro real. Regra não é prova. Antes do bloco 3, quem tem leitura em produção roda, e cola a saída no relatório:

```sql
SELECT t.slug, count(*) AS diagnosticos
FROM "MeridianAssessment" a JOIN "Tenant" t ON t.id = a."tenantId"
GROUP BY t.slug ORDER BY 2 DESC;

SELECT split_part(email, '@', 2) AS dominio, count(*) AS respondentes
FROM "MeridianRespondent" GROUP BY 1 ORDER BY 2 DESC;
```

Se qualquer tenant que não seja da Nebuloz aparecer com diagnóstico, ou qualquer domínio de e-mail que não seja da Nebuloz ou de perfil sintético de teste: **pare, não rode o bloco 3, e a decisão é do CEO.** Nesse caso a Nebuloz é operadora daquele dado (`operadora-controladora.md`), o apagamento e a retenção do backup dependem da instrução do controlador, e o cliente precisa saber antes. Eu redijo o aviso; o CEO envia.

Base do meu "não consigo afirmar": `memoria-empresa.md` diz que TOTVS é lead, "nenhum registro de trial no repo nem no banco de produção" (posição de 2026-09-22), e o parecer de 24/09 (§3) descreve os titulares do dogfood como o fundador e perfis sintéticos, com a ressalva de e-mail real de colega em `packages/database/scripts/2026-09-diagnostico-nebuloz.sql:124-130`. Isso é de antes de ontem e não cobre o que aconteceu desde então.

**C2 — O prazo de 30 dias é teto, e o DROP tem data (2026-10-29).** Aceito o prazo. O runbook já põe dono (Pilar), confirmação (Lacre) e "vai" do CEO. Falta uma linha: se o DROP não ocorrer em 2026-10-29, o RoPA fica declarando uma retenção que já não vale. Lacre abre lembrete com essa data quando o bloco 3 rodar (a data vale a partir do dia em que rodar, não de 29/09 se o reset escorregar).

**C3 — Pedido de titular dentro da janela.** O fluxo de eliminação (`lgpd-dsr.ts`) não alcança o schema `backup_meridian_20260929`. Se um respondente pedir eliminação enquanto o backup existir, a resposta "eliminado" só é verdadeira se a linha dele também sair do backup. Acrescentar ao runbook, na seção "Backup e prazo": pedido de eliminação de titular recebido dentro da janela → apagar as linhas dele no backup (como dono do banco) **ou** antecipar o `DROP SCHEMA`, e registrar qual dos dois. Além disso, a restauração antes do prazo tem que reaplicar qualquer eliminação pedida depois do reset, senão a restauração traz de volta dado que o titular mandou apagar. Uma frase de checagem antes do `INSERT ... SELECT`.

**C4 — PITR e backup da plataforma: conferir o número e registrar.** O runbook já diz que eles continuam além do `DROP` e que Lacre deve considerar isso. Correto. Mas ninguém escreveu **quanto tempo**. Pilar abre o painel Supabase (Database > Backups) e registra no relatório: retenção do backup diário e se PITR está ligado, com a janela. Eu não verifiquei (sem acesso ao painel; é hipótese que o plano tenha backup diário e que PITR seja add-on). Efeito prático: a **data efetiva de eliminação total** é `2026-10-29 + janela da plataforma`, não 2026-10-29. É essa data que o RoPA declara e que vale para responder titular.

**C5 — Bucket: registrar a contagem.** O runbook já exige citar quantos objetos havia. Mantenho como condição de fechamento, não de início.

## 1. Backup no banco (pergunta 1)

**O que é:** cópia integral de 13 tabelas, com nome, e-mail e cargo de respondentes (`MeridianRespondent`), respostas, evidências (metadado com `fileName` e `storagePath`), justificativas de override e gaps, de todos os tenants (`meridian-reset.sql:84-96`).

**Base legal para reter.** Sem inventar: não é art. 16, I (obrigação legal) nem art. 16, II (pesquisa). É a **continuação do tratamento original, com a mesma finalidade e a mesma base do dado de origem, por prazo curto, com a finalidade única de desfazer um apagamento errado.** Encaixa em dois pontos: art. 6º, VII e VIII (segurança e prevenção: não perder dado por erro nosso) e art. 7º, IX (legítimo interesse da Nebuloz em ter rede de segurança de uma operação destrutiva e sem volta). O teste de necessidade (art. 6º, III) passa porque: (a) a finalidade é restauração, não reuso; (b) o acesso está fechado (`REVOKE` de `PUBLIC`, `anon`, `authenticated`, `service_role`; RLS ligada e forçada, sem policy; abort se algum papel ainda tem `USAGE`, linhas 102-150); (c) há prazo e dono. A alternativa (sem backup) é pior para o titular só no cenário de erro operacional, e o bloco 3 é transacional, o que reduz esse cenário.

**Se o dado for de cliente externo** (C1), essa base não serve sozinha: a Nebuloz, como operadora, não decide reter além da instrução do controlador.

**Prazo de 30 dias.** Razoável para o objetivo (janela para notar um erro de escopo). Não peço encurtar. Se a conferência em C1 mostrar só dogfood e o CEO quiser menos exposição, 14 dias já cobre um ciclo de revisão; é preferência, não exigência.

**RoPA: sim, declarar.** O RoPA (`lgpd-ropa-e-lacunas.md`) não tem linha para retenção de backup do Meridian. Quando o bloco 3 rodar, eu incluo (texto pronto, para não depender de memória de ninguém):

> **Backup transitório do reset do Meridian.** Schema `backup_meridian_20260929`, 13 tabelas do domínio Meridian, todos os tenants. Dado pessoal: nome, e-mail e cargo de respondente; conteúdo de respostas e evidências. Finalidade: restaurar em caso de apagamento indevido. Base: continuação do tratamento original; art. 6º, VII e VIII; art. 7º, IX. Acesso: nenhum papel da API; só o dono do banco. Eliminação: `DROP SCHEMA` até 2026-10-29. Cópias da plataforma (backup diário/PITR do Supabase): persistem pela janela do plano, `[preencher com o número de C4]`, e não são apagáveis por nós antes disso.

**Achado lateral (não bloqueia o reset):** `dpa-fornecedores.md` V-05 registra **Neon** como o banco (`:139`), mas produção roda em **Supabase** (`memoria-empresa.md`, `project_prod_database`: projeto `aosdvvluokrbgpyqwoor`). O grep por "supabase" no arquivo não acha o fornecedor. Ou o registro está desatualizado, ou o Supabase (que também guarda o bucket `meridian-evidence` e os backups/PITR de que este parecer depende) está sem DPA registrado. Vou reabrir o V-05 depois do reset; peço a Morgana que avise se houver algo que eu não vejo (troca de fornecedor não documentada).

## 2. Bucket `meridian-evidence` sem backup (pergunta 2)

**OK.** Apagar sem backup é o lado favorável ao titular: menos retenção, alinhado à política de 90 dias já implementada e aceita no parecer de `856ad865` (`meridian-evidence-retention.ts`). O arquivo de evidência é o dado mais difícil de justificar reter (anexo livre de até 10 MB, `MAX_EVIDENCE_BYTES`), e o aviso do respondente já promete apagamento dele. Duas observações, sem bloquear:

1. O backup do banco guarda `MeridianEvidence.fileName` e `storagePath`. Restaurar antes do prazo devolve as linhas **sem** o arquivo (o runbook já diz, linha 101-102). Sem problema de privacidade; só evita que alguém trate a restauração como completa.
2. Depois do reset, o bucket tem objetos sem linha dona. Esvaziar o bucket é o que fecha isso. Se o esvaziamento falhar ou for parcial, esses objetos ficam fora da rotina de retenção (ela é guiada pelas linhas de `MeridianEvidence`, que terão sumido). Por isso C5: contagem antes, bucket vazio depois, ambos no relatório.

## 3. `AuditLog` (pergunta 3)

**Mantém. Mas corrijo o enquadramento que veio no pedido, e o meu próprio parecer anterior, para o que o código grava.** Em `856ad865` aceitei linhas de auditoria com `fileName` legado no `target`. Aqui a pergunta fala em `entityId` de registro apagado. Lendo `apps/app/app/(meridian)/actions/_shared.ts:59-115`, o que cada linha de auditoria do Meridian guarda é mais do que isso:

- `entityId`: id opaco (cuid). Depois do reset não aponta mais para nada (exceto, por 30 dias, para o backup). É o menor dos problemas.
- `metadata.target`: texto legível, exemplo do próprio código `"AS-104 · Vanta Saúde"` (código do diagnóstico e nome da organização).
- `metadata.actorName`: **nome (ou e-mail, se não houver nome) de quem agiu.** Para ato de respondente (`logRespondentAudit`), é o **nome do respondente**; para consultor, nome ou e-mail do usuário.
- `diff`: pares campo/antes/depois; **não li o que vai aí em produção** e não afirmo que não haja resposta ou justificativa livre.

Ou seja: depois do reset, o `AuditLog` continua com **nome de respondente e de usuário**, ligado a ações num diagnóstico que já não existe. Isso **já é verdade hoje**; o reset não cria nem agrava. Minha posição continua a de `856ad865`: **aceitar**, por três motivos que não mudam. Trigger append-only é a garantia central da ADR-0009 e da mitigação de R-004; abrir exceção de redação custa mais do que o dado pesa; o acesso é só de staff do tenant em `/settings/audit`. O fundamento é retenção de trilha por segurança e prestação de contas (art. 7º, IX; art. 16, I onde houver dever de guarda), e o RoPA já registra `AuditLog` como não coberto pelo DSR (`lgpd-ropa-e-lacunas.md`, §5, tabela).

O que muda é a **honestidade do registro**. O RoPA e qualquer resposta a titular não devem dizer "os dados do diagnóstico foram eliminados" sem ressalva: elimina-se o dado do diagnóstico, **permanece na trilha de auditoria o nome de quem agiu e um identificador do diagnóstico**. Sugiro essa frase na linha do RoPA de C2/§1.

**Um ponto de rastreabilidade, não de privacidade.** `MeridianSequence` é apagada, então o próximo diagnóstico volta a ser `AS-001` e o próximo gap `G-01` (runbook, linhas 22-24). Linhas antigas de auditoria com `target` `AS-001 · <organização>` passam a coincidir em código com diagnósticos novos. O `entityId` distingue, e o `target` leva o nome da organização, então não é ambíguo para quem lê com cuidado; mas quem exportar a trilha por código, sem `entityId`, junta atos de vidas diferentes do `AS-001`. Recomendo (não condiciono) que o relatório do reset **registre o próprio reset no `AuditLog`** com um `INSERT` (o trigger só barra `UPDATE` e `DELETE`): data, quem autorizou, contagens antes e depois. Isso explica na trilha por que as entidades sumiram e marca a fronteira entre as duas séries de `AS-001`.

## 4. Cliente externo (pergunta 4)

Resposta em C1. Em uma frase: pelas regras do parecer de 24/09 e pelo que consta em `memoria-empresa.md`, não deveria haver; **eu não tenho como confirmar e não vou deduzir**. Se a checagem de C1 mostrar dado de terceiro, o que eu recomendaria ao CEO decidir, sem ainda ter recomendação fechada porque depende do que aparecer: (a) excluir aquele tenant do escopo do reset (o SQL apaga tudo; exigiria `WHERE tenantId <> ...` nas 13 tabelas, ou seja, mudar o SQL que o Vigia aprovou, e ele precisa revisar de novo); ou (b) manter o reset global e avisar o cliente antes, com a Nebuloz operadora seguindo a instrução dele para o backup. Os dois são do CEO.

## Ajustes de texto no runbook (não bloqueiam a execução)

1. Seção "Antes de rodar": item novo com a checagem de C1, antes do bloco 1.
2. Seção "Backup e prazo": frase de C3 (pedido de titular na janela e reaplicação de eliminação na restauração) e o registro de C4 (janela da plataforma) no relatório.
3. Seção "Depois do SQL": citar a recomendação de registrar o reset no `AuditLog` (§3).

## Decisões

- 2026-09-29 — Compliance/DPO libera o reset do Meridian em produção **com condições**: C1 (checagem de tenant e domínio) antes do bloco 3, C2 a C5 conforme acima. Sem C1 cumprida não há liberação.
- 2026-09-29 — Backup `backup_meridian_20260929`: base = continuação do tratamento original, arts. 6º, VII e VIII e 7º, IX; teto de 30 dias, DROP em 2026-10-29 contado do dia do bloco 3; janela da plataforma (backup diário/PITR do Supabase) a registrar, não verificada por mim.
- 2026-09-29 — RoPA: incluir a linha do backup transitório quando o bloco 3 rodar (texto em §1). Aguarda a execução para não declarar retenção que ainda não existe.
- 2026-09-29 — `AuditLog`: mantém, sem alterar o trigger; corrijo o enquadramento de `856ad865`: a trilha retém também `actorName` (nome de respondente/usuário) e `target`, não só id. Não é agravado pelo reset.
- 2026-09-29 — Bucket: apagar sem backup é aceito; contagem antes e depois no relatório.

## Resultado da C1 (2026-09-29, leitura em produção feita pela Morgana)

Fonte: relato da Morgana, consultas rodadas no SQL Studio, projeto `aosdvvluokrbgpyqwoor`, papel `postgres`, só leitura. Não vi a saída bruta.

- Tenants com diagnóstico: `nebula` (2 diagnósticos, criado 2026-08-04, 1 membro) e `nebuloz` (1 diagnóstico, criado 2026-08-02, 2 membros). Nenhum tenant de cliente.
- Domínios de respondente: `nebuloz.ai` 5, `gmail.com` 5. Os 5 de `gmail.com` estão nesses dois tenants.

**C1 PASSA. Os respondentes `gmail.com` não exigem decisão do CEO.** Motivo: o que a C1 protege é a Nebuloz operar dado de terceiro sob instrução de outro controlador. Aqui o tenant é da própria Nebuloz, então ela é controladora e a base do §1 vale. Domínio `gmail.com` não prova que a pessoa é de fora, e mesmo sendo (colega, conselheiro, amigo convidado ao dogfood) o efeito do reset sobre ela é apagar o dado, com cópia fechada por no máximo 30 dias. Não há cliente a avisar. O caso é o da ressalva do parecer de 24/09 (§3, e-mail real de colega em `2026-09-diagnostico-nebuloz.sql:124-130`), já aceito para dogfood.

**Uma confirmação residual, barata:** que o tenant `nebula` é da Nebuloz e não um trial de prospect. A premissa "nenhum registro de trial" (`memoria-empresa.md`, 2026-09-22) e o nome parecido não bastam como prova. Sem listar e-mail individual:

```sql
SELECT t.slug, split_part(u.email, '@', 2) AS dominio, count(*) AS membros
FROM "TenantMember" m
JOIN "Tenant" t ON t.id = m."tenantId"
JOIN "User" u ON u.id = m."userId"
WHERE t.slug IN ('nebula', 'nebuloz')
GROUP BY 1, 2 ORDER BY 1, 2;
```

Se o membro de `nebula` for `nebuloz.ai` (ou o fundador), fecha. Se for domínio de terceiro, aí sim pára e é do CEO. Esta confirmação é condição da C1; as demais (C2 a C5) seguem como estão.

### Decisão adicional
- 2026-09-29 — Compliance/DPO: C1 passa com base no resultado acima; respondentes `gmail.com` dos tenants internos não exigem decisão do CEO. Fica a confirmação de titularidade do tenant `nebula`.

### Fechamento da C1 (2026-09-29)

Fonte: relato da Morgana, conferência por comparação booleana em produção, sem ler e-mail. Não vi a saída.

- `nebula`: único membro é o fundador (ADMIN). Não é trial de prospect.
- `nebuloz`: o fundador e mais um ADMIN de outro domínio. Segundo a Morgana, é pessoa da própria empresa; isso é declaração dela, sem verificação minha. Não muda o enquadramento: o tenant é da Nebuloz, ela é controladora, e o efeito do reset sobre essa pessoa é apagar o dado.

**C1 fechada. Reset liberado do ponto de vista de compliance, sujeito a C2 a C5.** A autorização de escrita em produção continua sendo do CEO, por operação.

- 2026-09-29 — Compliance/DPO: C1 fechada; titularidade de `nebula` confirmada.
