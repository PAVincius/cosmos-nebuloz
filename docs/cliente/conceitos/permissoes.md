---
title: Permissões
sidebar_label: Permissões
sidebar_position: 1
---

# Permissões

O Cosmos decide o que você vê e o que você pode fazer a partir do seu
**papel efetivo** — seu papel SAFe dentro do tenant, que pode variar por ART.

## Papel efetivo

Seu papel (Portfolio Manager, RTE, Product Owner, Scrum Master, Admin etc.) é
atribuído por um Admin do tenant em **Settings → Membros**. O papel pode ser
escopado por ART: nada impede você de ser RTE do ART A e Product Owner de um
time do ART B ao mesmo tempo.

Sem papel atribuído, você entra no tenant mas não enxerga nenhuma tela de
produto — é o primeiro lugar a checar se algo parece "sumido".

## Permissão e papel customizado

Cada ação no Cosmos — editar um épico, aprovar um gate de governança,
registrar um confidence vote — exige uma **permissão**. Permissões vêm da
matriz padrão do seu papel, e opcionalmente de um **papel customizado**
atribuído por cima.

Papel customizado é sempre **aditivo**: ele pode dar permissão a mais, nunca
tirar permissão que a matriz padrão já concede. Não existe "papel customizado
restritivo" no Cosmos — se você precisa restringir alguém, o caminho é dar um
papel padrão mais enxuto, não customizar um papel para negar acesso.

## Autenticação de dois fatores (2FA)

Papéis com privilégio elevado — **Admin** e **STE** — exigem 2FA verificado
para agir. Se seu papel é um desses e você ainda não configurou 2FA, o
Cosmos vai pedir antes de liberar ações sensíveis.

## Isolamento entre organizações

Nenhuma tela do Cosmos mistura dado de dois tenants: se sua empresa tem mais
de uma organização cadastrada, trocar de tenant é uma ação explícita — o
Cosmos nunca mostra os dois ao mesmo tempo na mesma tela.

## O que acontece quando falta permissão

Se você tentar uma ação sem a permissão necessária, o Cosmos bloqueia e
registra a tentativa negada na trilha de auditoria do tenant — isso é
esperado e faz parte de como o produto garante rastreabilidade, não é um bug.
Se você acha que deveria ter acesso, peça pro Admin do tenant revisar seu
papel em **Settings → Membros**.
