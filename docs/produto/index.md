---
slug: /
title: Documentação de produto
sidebar_label: Início
sidebar_position: 0
---

# Documentação de produto

Seis produtos dividem o mesmo monorepo e a mesma base de tenants. O
[mapa de fronteiras](./mapa-de-fronteiras.md) diz quem é dono de cada entidade
compartilhada — tenant, permissão, baseline, portfólio, escala de confiança — e o
que os outros podem fazer com ela. Ele é o alvo: onde o código diverge, é gap a
fechar, não precedente.

## A cadeia

Quatro produtos em sequência e dois transversais. A pergunta que cada um
responde é a sua fronteira.

| Produto | Papel | Pergunta | Quem usa | Estado na main | Documentos |
|---|---|---|---|---|---|
| Meridian | AVALIAR | "Estamos prontos?" | Consultoria Nebuloz; o cliente responde por link | V1 no código; sem cliente pago comprovado | [PRD](./meridian-prd.md) · [SRD](./meridian-srd.md) · `specs/001-meridian-diagnose` |
| Scaffold | CONTRATAR | "O que foi prometido?" | Time de adoção do cliente, com a supervisão da consultoria no back-office | V1 no código; o fluxo não fecha sem SQL manual | [PRD](./scaffold-prd.md) · [SRD](./scaffold-srd.md) · `specs/002-scaffold-adoption` |
| Cosmos | EXECUTAR | "O que estamos fazendo?" | RTE, LPM, PO e Scrum Master de organizações em SAFe | Em produção em `/cosmos` | [PRD](./cosmos-prd.md) · [SRD](./cosmos-srd.md) · `docs/cliente/` |
| Signal | APURAR | "Valeu a pena?" | CFO e Head de Operações | V1 no código desde 2026-09-04; não operável só pela interface | [PRD](./signal-prd.md) · [SRD](./signal-srd.md) · `specs/003-signal-measure` |
| Charter | GOVERNAR, transversal | "É permitido? Sob qual risco?" | Compliance, CISO, People Ops, AI Program Lead, auditor | Em produção desde julho | [PRD](./charter-prd.md) · [SRD](./charter-srd.md) |
| Back-office (Big Bang) | VENDER E OPERAR, transversal | "Como isso entra e roda?" | Equipe Nebuloz: CS, RevOps, plataforma, segurança | Em produção em backoffice.nebuloz.ai | [PRD](./backoffice-prd.md) · [SRD](./backoffice-srd.md) |

O site público conta a mesma suíte como jornada comercial — Diagnosticar,
Estruturar, Medir, Governar, Operar (`packages/internationalization/dictionaries/pt.json`).
Essa é a narrativa de venda; donos de dado e costuras seguem o mapa.

Fora da cadeia: o **LAB**, registro do modelo próprio da Nebuloz — que dado
entrou, que treino rodou, que avaliação mediu. Está em especificação, sem
código: [PRD](./lab-prd.md) · [SRD](./lab-srd.md).

## Como ler

- O **PRD** responde por que e para quem; o **SRD** responde como, e é onde
  moram as invariantes que um teste precisa proteger.
- Nos documentos consolidados em 2026-09-22, cada requisito diz o estado na
  `main` — implementado, parcial ou ausente — com o arquivo que prova.
- As specs em `specs/` são fatias de implementação; quando divergem do PRD/SRD,
  o documento de produto diz qual vale.
- [Trilhas](./trilhas/MAPEAMENTO.md) — onde cada camada dos templates de trilha
  de IA (governança, conformidade, segurança) vira dado na suíte.
- [Pesquisa de mercado do Scaffold](./pesquisa-mercado-scaffold.md).

## Fontes externas

Parte dos requisitos nasceu fora do repositório. O texto normativo foi
transcrito para cá; os originais continuam fora do git.

| Fonte | O que decide | Transcrita em |
|---|---|---|
| Mapa de fronteiras (arquitetura de produto, ago/2026 v1) | dono de cada uma das 16 entidades compartilhadas, 6 costuras, 5 colisões | [mapa-de-fronteiras.md](./mapa-de-fronteiras.md) |
| Charter — SRD & Data Model (projeto de design, ago/2026) | requisitos por tela, modelo de dados, fórmulas de governança, sistema visual | [charter-srd.md](./charter-srd.md) e `apps/app/components/charter/DESIGN.md` |
| Big Bang — PRD & SRD (projeto de design, ago/2026) | requisitos do back-office, micro-interações compartilhadas, fórmula de proposta | [backoffice-prd.md](./backoffice-prd.md), [backoffice-srd.md](./backoffice-srd.md) e `apps/backoffice/DESIGN.md` |

## Contexto para agentes

Cada produto tem `PRODUCT.md` (verdade de produto) e `DESIGN.md` (sistema
visual) na própria pasta — `apps/app/components/<produto>/` para os cinco de
cliente, `apps/backoffice/` para o back-office — e é isso que o `/impeccable`
carrega quando o alvo está ali. As notes dos especialistas do Maestri, em
`.maestri/knowledge/<produto>/`, apontam para estes documentos e são
regeneradas com `pnpm knowledge:refresh`.

---

## Como editar

Estes arquivos moram em `docs/produto/` na raiz do repositório — não dentro do
site. Editar em PR é o único caminho: o site publica o que está na `main`, e o
botão *Edit this page* de cada documento aponta para o arquivo de origem.
