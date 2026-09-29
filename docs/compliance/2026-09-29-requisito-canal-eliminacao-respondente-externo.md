# Requisito mínimo — canal para o respondente externo pedir eliminação

- **Data:** 2026-09-29
- **Autor:** Compliance / DPO
- **Para:** Regua e Bussola (implementação), Norte (decisão de produto). Condição 11 de `docs/qualidade/prontidao/meridian.md`.
- **Base:** `2026-09-24-parecer-meridian-respondente.md` §4; `lgpd-ropa-e-lacunas.md` §4 e §5; `apps/app/lib/inngest/lgpd-dsr.ts`; `apps/app/app/(meridian)/actions/respondent.ts`; `apps/app/app/meridian-responder/[token]/page.tsx`.
- **O que este documento é:** requisito, não desenho. Diz o que o canal precisa fazer e o que não pode fazer. Código e interface são de quem implementa. Não vi produção.

## O problema, em fatos

- O respondente entra por link com token de uso individual, sem conta (`meridian-responder/[token]/page.tsx`). Token inválido, expirado e revogado caem no mesmo texto de propósito, para não confirmar a um estranho que o diagnóstico existe.
- O fluxo de eliminação (`processErasureRequest`, `lgpd-dsr.ts`) exige `User.id` e casa o respondente pelo **e-mail do `User`**. Respondente que nunca foi usuário da plataforma não é alcançado.
- `DataSubjectRequest` guarda `tenantId`, `subjectId`, `type`, `status`, `metadata` (`system.prisma:119`). Não há campo para "quem pediu não tem conta".
- Hoje o único caminho é o cliente acionar, ou o titular escrever para uma caixa de e-mail que o texto público ainda não divulga.

## Uma tensão que o requisito precisa resolver

O memo `2026-09-29-memo-ceo-operadora-controladora-meridian.md` recomenda a Nebuloz como **operadora**: ela não decide o mérito do pedido, encaminha ao cliente. A condição 11 pede um canal "sem depender do cliente". As duas coisas cabem, se se separar **receber** de **decidir**:

- **Receber e registrar:** o respondente consegue fazer o pedido sem passar pelo cliente e sem conta. Isto é da Nebuloz, e é o que este requisito cobre.
- **Decidir e executar:** o cliente, como controlador, instrui; a Nebuloz executa. A exceção é a instrução prévia por inércia (DPA §9.3, cláusula C8 do memo, **só com decisão do CEO**). Sem ela, "sem depender do cliente" vale para pedir, não para ser atendido.

Se o CEO escolher a opção B (controladora), o canal passa a decidir e executar por conta própria, e este requisito muda.

## Requisitos mínimos

**R1. Ponto de entrada visível para quem tem o link.** Na tela do respondente (`respondent-form.tsx`), ação "Pedir eliminação dos meus dados", visível em todos os estados (rascunho, concluído) e em texto simples, ao lado do aviso que já existe. Não pode ficar atrás de login nem de convite novo.

**R2. Pedido por token válido e pedido sem token.** Dois caminhos, e os dois precisam existir:
- **Com token válido:** um passo de confirmação; o pedido fica ligado ao `MeridianRespondent` daquele token. Posse do token já dá acesso a tudo que o respondente preencheu; pedir eliminação não expõe nada a mais.
- **Sem token (link perdido, expirado ou revogado):** formulário público mínimo (e-mail com que foi convidado; nome da organização, se souber; texto livre opcional e curto). Existe porque token expirado ou revogado cai no mesmo texto de "inválido" e ali não se identifica ninguém.

**R3. Resposta idêntica, sempre.** O caminho sem token responde o mesmo texto quer o e-mail conste do banco ou não ("recebemos; se encontrarmos, encaminhamos e avisamos"). Sem oráculo de existência. Limite de taxa por endereço e por e-mail, no mesmo padrão do lookup do token (`respondent.ts`, commits `1646b50e`, `011c75f7`, `3db7c7b5`).

**R4. Confirmação de titularidade antes de agir, nos dois caminhos.** Caminho sem token: enviar ao e-mail informado um link de confirmação de uso único e só então registrar o pedido como válido; o e-mail nunca recebe dado do diagnóstico. Caminho com token: a posse do token confirma. Sem isso, qualquer pessoa pediria a eliminação dos dados de outra (dano à integridade do diagnóstico do cliente) ou tentaria descobrir quem é respondente.

**R5. Registro rastreável.** Cada pedido vira um registro com: tipo (eliminação; acesso e correção como extensão futura), data e hora de recebimento (o relógio de 5 e 15 dias úteis corre daqui), estado (`recebido → confirmado → encaminhado → instruído → executado | negado pelo cliente`), organização (tenant) identificada, e o meio (token ou formulário). O `subjectId` usa o **id do `MeridianRespondent`**, não o e-mail; o e-mail vai em campo próprio ou em `metadata` mascarado. Reaproveitar `DataSubjectRequest` exige campo ou convenção nova para "titular sem conta"; decisão de Bussola, com parecer meu.

**R6. Encaminhamento ao cliente, não decisão.** Ao confirmar, a plataforma notifica os administradores do tenant dono do diagnóstico (papel que o cliente já designa) com: o pedido, o prazo legal, e as ações "instruir eliminação" e "negar, com motivo". A Nebuloz copia o encarregado. O prazo de repasse é o do DPA §9.2: **5 dias úteis**.

**R7. Aviso ao titular.** Confirmação imediata de recebimento; e, no repasse, aviso de que o pedido foi encaminhado **e a quem** (nome da organização), art. 18, § 4º, I. Texto sem promessa de prazo de eliminação que a plataforma não cumpra.

**R8. Execução por instrução, com o que é real.** Quando o cliente instrui, a eliminação alcança **o que o respondente tem**, chaveada pelo id do respondente, não pelo e-mail do `User`: anonimiza `name`, `email`, `role`; invalida o token; apaga os objetos do bucket que ele anexou (`uploadedByRespondentId`); preserva `MeridianResponse` e o score do cliente (mesma lógica de `lgpd-ropa-e-lacunas.md` §5). É trabalho novo: `processErasureRequest` não cobre esse titular. Enquanto o Inngest de produção não for verificado, a execução é manual (playbook `2026-09-29-playbook-pedido-do-titular.md`, passo 7).

**R9. Retorno ao titular com a verdade.** Quando executado, aviso do que foi eliminado e a data efetiva total, considerando a janela de cópias da plataforma (ver `2026-09-29-roteiro-fechamento-backup-reset-meridian.md`) e o que a trilha de auditoria retém. Nunca "eliminado de todos os lugares".

**R10. Trilha sem dado a mais.** Cada passo grava em `AuditLog` (`actorType` `respondent` ou `system`), com identificadores. Não gravar nome ou e-mail em `target`, `actorName` ou `diff`: o parecer de 2026-09-29 sobre o reset mostrou que a trilha já retém nome de respondente, e ela é imutável (ADR-0009).

**R11. Texto e canal alternativo.** O formulário aponta para o texto público (`2026-09-29-texto-publico-canal-do-titular.md`) e para o e-mail do canal. E-mail continua sendo caminho válido; o playbook cobre o pedido que chegar por lá.

## O que este requisito não cobre

- **Participante de reunião gravada.** Sem token e sem link; o único caminho é o e-mail e o playbook. Tem a mesma lacuna, com desenho diferente; fica para depois do Meridian.
- **Acesso, correção e portabilidade.** Só eliminação, que é o que a condição 11 pede. O desenho de R5 deixa o tipo extensível.
- **O mérito.** Reter dado por obrigação legal ou exercício regular de direitos é decisão do controlador.

## Critérios de aceite

1. Respondente com link válido pede eliminação sem login e recebe confirmação; o pedido aparece para o admin do tenant com prazo.
2. Pedido sem token com e-mail inexistente e com e-mail existente retorna **a mesma** resposta e o mesmo tempo aproximado.
3. Pedido sem confirmação do e-mail não é encaminhado.
4. Depois da instrução do cliente, `MeridianRespondent.name/email/role` ficam anonimizados, o token invalida, os objetos anexados saem do bucket, `MeridianResponse` permanece.
5. `AuditLog` traz cada passo sem nome nem e-mail do respondente no `diff`, `target` ou `actorName`.
6. Teste automatizado de fronteira entre tenants: pedido de um respondente nunca chega a admin de outro tenant.

## Dependências e ordem

| Dependência | Dono |
|---|---|
| Decisão do enquadramento (A/B/C) e da cláusula C8 | CEO |
| E-mail do canal e encarregado | CEO |
| Convenção para "titular sem conta" no registro | Bussola, com parecer de Lacre |
| Parecer de Lacre antes de ir ao ar | Lacre (eu) |
| Inngest de produção verificado, se a execução for automática | Infra/SRE, "vai" do CEO |

Até isso existir, o caminho legítimo é o e-mail com o playbook: cobre o primeiro pedido, não o volume.

## Decisões

- 2026-09-29 — Compliance/DPO: a condição 11 se cumpre separando receber (canal próprio, sem conta) de decidir (cliente), com a exceção de C8 dependente do CEO. Não bloqueia o dogfood; **recomendo tê-la, ao menos como e-mail com playbook, antes do primeiro respondente de cliente externo**.
