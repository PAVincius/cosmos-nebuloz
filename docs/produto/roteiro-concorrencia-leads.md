# Roteiro: quantas pessoas usam ao mesmo tempo (3 leads)

**Autor:** Norte (CPO) · **Data:** 2026-09-27 · **Para:** o CEO, que leva a conversa. O Norte não envia nada para fora.
**Origem:** spec 007, tarefa T009 (`specs/007-gate-maturidade-carga/tasks.md:70`). O resultado alimenta o SC-011 (`meridian-prd.md` §6) e a T010.

## Por que perguntar

O SC-011 cobra p95 < 2 s e erro < 1% com "algumas centenas de usuários simultâneos por tenant". Esse número **não tem fonte** (`regra-maturidade-e-carga.md:38-40`). Sem número real, o teste de carga pode otimizar a coisa errada. Já aconteceu uma vez (`docs/qualidade/escala-backoffice-10k.md`).

**Com quem falar:** a TOTVS e os outros dois leads do funil (`playbook-de-vendas.md:99`: "TOTVS mais dois leads no funil"). Os nomes dos outros dois não estão no repositório; o CEO sabe quem são.

## Cuidado antes de perguntar

1. **Os leads ainda não usam o Meridian.** A pergunta não pode ser "quantos usam o Meridian ao mesmo tempo". Ela tem que ser sobre como o evento acontece hoje na empresa deles: o PI Planning e um diagnóstico com muitas pessoas. A conta de concorrência sai daí.
2. **O Meridian tem dois picos possíveis, e o cenário da spec cobre um só.** A spec fixou o PI Planning como cenário (FR-005). No Meridian, porém, quem gera carga ao mesmo tempo é mais provavelmente **a onda de respondentes**: o consultor dispara os links e dezenas de pessoas respondem a bateria na mesma janela. O roteiro pergunta pelos dois. Se o pico real for a coleta, o Norte propõe ao PO ajustar o cenário do SC-011. O PI Planning é, de fato, o pico do Cosmos.
3. **Não citar a TOTVS** para os outros leads, nem em material externo (`lancamento-oferta.md:65`).

## Perguntas (15 minutos, em qualquer conversa com o lead)

**A. Tamanho (para o denominador)**
1. Quantos ARTs vocês têm hoje? Quantas pessoas, em média, por ART?
2. Quantas pessoas participam de um PI Planning? Todas ao mesmo tempo, ou por turnos ou trens?

**B. PI Planning (pico do cenário da spec)**
3. No momento mais cheio do PI Planning (quebra em times, leitura de rascunho, voto de confiança), quantas pessoas estão com a ferramenta aberta **ao mesmo tempo**?
4. Quantas estão **editando** ao mesmo tempo, e quantas só olhando?
5. Isso acontece num dia só, ou em dois dias com picos em horários fixos?

**C. Diagnóstico com muitos respondentes (pico provável do Meridian)**
6. Numa pesquisa ou diagnóstico interno (maturidade, clima, prontidão), para quantas pessoas vocês mandariam o questionário?
7. Mandam para todo mundo de uma vez, ou por área?
8. Em quanto tempo a maioria responde? Na primeira hora, no mesmo dia, na semana?
9. Há o hábito de "todo mundo responde agora, na reunião"? Se sim, com quantas pessoas na sala?

**D. Várias unidades (para "dezenas de tenants")**
10. Mais de uma unidade, empresa do grupo ou cliente de vocês usaria ao mesmo tempo, em contas separadas?

## Como registrar a resposta

Uma linha por lead, **com o número que o lead disse**, sem arredondar e sem juntar com outros:

| Lead | Data | Quem respondeu (cargo) | Pessoas por ART × ARTs | Pico simultâneo no PI Planning (abertas / editando) | Questionário: enviados / respondem na 1ª hora | Unidades em paralelo | Observação |
|---|---|---|---|---|---|---|---|
| TOTVS | | | | | | | |
| Lead 2 | | | | | | | |
| Lead 3 | | | | | | | |

Nome de pessoa e dado de contato **não** entram aqui. Basta o cargo.

## O que o Norte faz com o resultado (T010)

- Número para o SC-011: **o maior pico declarado entre os três,** com a fonte ("lead X, cargo, data") e margem de 2×, porque é uma estimativa verbal. Sai o rótulo HIPÓTESE, entra "validado", e a decisão fica registrada em `regra-maturidade-e-carga.md` § Decisões.
- Se o pico do bloco C for maior que o do bloco B, o Norte propõe ao PO trocar o cenário do SC-011 para "onda de respondentes". O PI Planning passa a ser o cenário do Cosmos quando ele entrar no gate.
- Se só um lead responder, o número continua **hipótese com uma fonte**. Não vira "validado" com n = 1.
