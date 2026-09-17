---
title: Conceitos centrais
sidebar_label: Conceitos centrais
sidebar_position: 0
---

# Conceitos centrais

Quatro ideias explicam a maior parte do que você vê no Cosmos. Vale entender
antes de navegar pelas telas — elas se repetem em toda a plataforma.

## Tenant

Seu **tenant** é a sua organização dentro do Cosmos: todo dado — épico,
time, PI, membro — pertence a um tenant, e nenhuma tela mostra dado de outro
tenant. É a fronteira de isolamento total da plataforma.

## Módulo

Um tenant pode contratar módulos independentes: **Cosmos** (o que este site
documenta), **Charter** (política de uso de IA, casos, fornecedores,
conformidade) e outros. Cada módulo tem status próprio — sua organização pode
ter só o Cosmos ativo, ou Cosmos e Charter juntos.

## Altitude

O SAFe organiza decisão em quatro altitudes, e o Cosmos segue a mesma
divisão:

| Altitude | O que acontece ali | Onde fica no Cosmos |
|---|---|---|
| **Portfólio** | dinheiro vira aposta | Portfolio |
| **ART** | aposta vira compromisso de PI | ART Board |
| **Time** | compromisso vira trabalho | Times → board do time |
| **Liderança / Analytics** | trabalho vira métrica consolidada | Analytics |

Cada altitude tem sua própria tela, mas todas leem do mesmo modelo de dados —
por isso um número em Analytics sempre bate com o board de origem.

## Hierarquia de trabalho

Da aposta de portfólio até a tarefa do dia a dia, o trabalho é modelado como
uma cadeia:

```
Épico → Feature → Story → Task
```

Um **Épico** vive na altitude de portfólio. Ao ser aprovado, vira uma ou mais
**Features** distribuídas entre times de um ART. Cada Feature quebra em
**Stories**, e cada Story em **Tasks** — o nível onde o trabalho de fato
acontece dentro do board do time.

## ART e Team

Um **ART (Agile Release Train)** agrupa um ou mais **Teams**. Um time sempre
pertence a exatamente um ART; um ART pode ter vários times. É essa relação
que organiza o PI Planning: o RTE do ART planeja o PI olhando o compromisso
de todos os times daquele trem.

---

Continue para [Permissões](./permissoes.md) para entender quem pode ver e
fazer o quê dentro do seu tenant.
