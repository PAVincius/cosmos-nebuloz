---
slug: /
title: Documentação de produto
sidebar_label: Início
sidebar_position: 0
---

# Documentação de produto

Dois produtos dividem o mesmo monorepo e a mesma base de tenants, com fronteira
explícita entre eles.

| PRODUTO | QUEM USA | O QUE FAZ |
|---|---|---|
| [Cosmos](./cosmos-prd.md) | Cliente | Portfólio, ART, time e analytics de SAFe sobre um único banco de fatos |
| [Back-office](./backoffice-prd.md) | Nebuloz | Contrata, provisiona, acompanha e cobra o cliente sem abrir o banco |

Cada produto tem dois documentos, e a divisão é de audiência: o **PRD** responde
por que e para quem; o **SRD** responde como, e é onde moram as invariantes que
um teste precisa proteger.

## Cosmos

- **[PRD](./cosmos-prd.md)** — problema, usuários, as nove áreas, 22 requisitos,
  riscos e questões em aberto.
- **[SRD](./cosmos-srd.md)** — guard de tenant, matriz de permissão, contrato
  `Result<T>`, modelo de dados das quatro altitudes e derivação de métrica.

## Back-office

- **[PRD](./backoffice-prd.md)** — a operação fora do console, as sete áreas e a
  fila de aprovação.
- **[SRD](./backoffice-srd.md)** — `requirePlatformStaff`, trilha append-only,
  saúde derivada e as fronteiras com o produto.

---

## Como editar

Estes arquivos moram em `docs/produto/` na raiz do repositório — não dentro do
site. Editar em PR é o único caminho: o site publica o que está na `main`, e o
botão *Edit this page* de cada documento aponta para o arquivo de origem.
