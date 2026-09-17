---
title: Integrações
sidebar_label: Integrações
sidebar_position: 4
---

# Integrações

O Cosmos não pede pra você abandonar as ferramentas onde seu time já
trabalha — ele sincroniza com elas.

## Linear e GitHub

O Cosmos importa e sincroniza incrementalmente épico, issue, pull request e
deploy a partir do Linear e do GitHub. A sincronização é automática depois
de configurada: novas issues e PRs vinculados aparecem no board do time sem
precisar recriar o item manualmente no Cosmos.

Configure a conexão em **Settings → Integrações**, com um Admin do tenant.

## Webhooks de saída

Se você quer que outro sistema seja notificado quando algo muda no Cosmos —
um épico muda de estado, um PI é planejado — configure um
**webhook endpoint** de saída em **Settings → Integrações**. Cada entrega
fica registrada com log de sucesso ou falha, e entregas que falharem ficam
visíveis numa fila de reprocesso (DLQ) — você não perde uma notificação por
o outro sistema estar fora do ar no momento do disparo, e pode reenviar
manualmente depois.

## API keys

Para automações próprias ou integrações que o Cosmos ainda não tem
nativamente, gere uma **API key** em **Settings → Integrações**. A chave
respeita o mesmo sistema de papel e permissão de quem a gerou — ver
[Permissões](../conceitos/permissoes.md).

## O que o Cosmos não tem hoje

Não existe um construtor de automação de uso geral (do tipo "se X, então
faça Y") dentro do Cosmos. O que existe são os três mecanismos acima —
sincronização com Linear/GitHub, webhooks de saída e API — que cobrem a
maior parte dos casos de conectar o Cosmos a outra ferramenta.
