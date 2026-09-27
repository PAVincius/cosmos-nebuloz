# 2026-09-27 — Pacotes e precificação validados contra LTV/CAC

Branch `claude/great-cori-herb4x`. Só documento: nenhuma escrita em banco,
nenhum código.

## O que entrou

- `docs/comercial/pacotes-e-precificacao.md` — quatro pacotes (Ideação,
  Validação, Growth, Scale) com preço por assento, mínimo, teto, franquia de IA
  por assento, preço do crédito extra e suporte; trilha de produto avulso com
  franquia por produto e piso de venda consultiva; Scaffold por fórmula; regra
  de abatimento do Diagnóstico; unit economics no pior caso da alçada, estresse
  e a leitura invertida (CAC e churn máximos por pacote); o que falta no sistema.
- `docs/comercial/icp-e-precificacao.md` — nota de atualização apontando para o
  novo documento e marcando o que envelheceu (SV-01 já tem preço; Scaffold e
  Signal têm código).

## Achados que mudaram a proposta recebida

- Linha do Scale comparava contra 250 assentos, não 101.
- O "avulso equivalente" não somava os add-ons incluídos; o desconto real é
  plano em ~21%.
- Mínimo = teto criava degrau de +71% Validação→Growth; com mínimo abaixo do
  teto (motor já suporta), o degrau cai para +4%.
- MCP não existe no app; saiu do Growth.
- Só Cosmos e Charter chamam modelo; Meridian, Signal e Scaffold não.
- Não há medição de crédito, nem checagem de assento no convite; as cotas de IA
  leem `Tenant.plan`, não `PlanoComercial`.

## Verificação

Modelo em Python no scratchpad da sessão (não versionado); tabelas do
documento conferidas contra a saída dele. CAC, churn, tributos, infra e custo
do crédito são hipóteses, marcadas como tal no §6.1.

## Pendências

- Caixa: CAC real, custo do crédito medido, regime tributário, infra por conta.
- Engenharia (§8 do documento): produtos inclusos no plano, crédito no
  catálogo, medição, reconciliação `Tenant.plan` × pacote, limite no convite.
