# LAB — Product Requirements Document

> **PRODUCT** LAB (modelo próprio) · **STAGE** Especificação · **STATUS** Draft for review
> **VERSION** 1.0 · **OWNER** Product, Nebuloz
> **COMPANION** [LAB SRD v1.0](./lab-srd.md) · [Back-office PRD v1.0](./backoffice-prd.md)

O registro do modelo próprio da Nebuloz. Que dado entrou, que treino rodou, que
avaliação mediu, e qual ficha isso gera — reconstruível sem perguntar a ninguém.

---

## 1. Problema

A Nebuloz vende governança de IA. O Charter mede o cliente contra regulação, e a
pergunta que ele faz ao cliente é sempre a mesma: *com que dado esse modelo foi
treinado, quem aprovou, e o que a avaliação mostrou?*

A Nebuloz não sabe responder isso sobre os próprios modelos. Dataset vive em
bucket com nome de pessoa, treino vive em notebook, resultado de avaliação vive
em mensagem de chat, e a ficha do modelo não existe. Quando alguém pergunta
"esse modelo viu dado de cliente?", a resposta é uma reconstrução — a mesma
reconstrução que o back-office veio eliminar para provisionamento.

> **POR QUE ESTE É O GARGALO**
> Não é o treino que trava, é a prova. Vender conformidade sem ter a própria
> casa registrada é a posição mais frágil possível numa auditoria de cliente: a
> primeira pergunta do comprador enterprise é sobre o fornecedor, não sobre o
> produto.

### Evidência

- Nenhuma entidade de dataset, treino, avaliação ou modelo existe no schema —
  conferido contra os 151 models.
- O back-office prometia seis rotas de LAB no menu. Nenhuma abria. Saíram do
  painel em favor deste documento.
- O Charter cobra do cliente artefatos (linhagem, model card, avaliação) que a
  Nebuloz não produz sobre si.
- Não há registro de qual versão de modelo está servindo qual funcionalidade
  hoje.

### Por que agora

| DATA | O QUE PASSA A VALER | FONTE |
|---|---|---|
| 2 ago 2026 | Transparência do AI Act (Art. 50) — vigente, sem adiamento | Digital Omnibus não move o Art. 50(1) |
| 2 dez 2026 | Marcação de conteúdo sintético (Art. 50(2)), com carência de seis meses | Proposta do omnibus |
| 2 dez 2027 | Alto risco, Anexo III — **proposto**, ainda em trílogo | Posição do Parlamento, 26 mar 2026 |
| Em aberto | Marco Legal da IA (PL 2338/2023) — aprovado no Senado, na Câmara | Volta ao Senado depois |

ISO/IEC 42001 já aparece como requisito em edital público europeu, e a evidência
que um Estágio 2 pede — registros, logs, avaliações, atas — é exatamente o que o
LAB produziria como subproduto de operar.

> **A DATA NÃO É O ARGUMENTO**
> Se o alto risco escorregar para dezembro de 2027, nada aqui muda: a exposição
> assimétrica favorece registrar cedo. O custo de ter linhagem sem precisar dela
> é uma tabela; o de precisar sem ter é reconstruir o passado.

---

## 2. Usuários

| PAPEL | TRABALHO A FAZER | SUCESSO É |
|---|---|---|
| Engenharia de ML | Registrar o que treinou, com que dado, e o que mediu | Registro como subproduto do treino, não como formulário depois |
| Compliance | Provar a terceiro o que entrou no modelo | Linhagem que se percorre até o dataset de origem |
| Comercial | Responder due diligence de comprador enterprise | Model card publicável sem passar por engenharia |
| Segurança interna | Auditar acesso a dado de treino | Capability própria, não herdada de admin |
| Charter | Referenciar o modelo próprio ao responder um requisito | Cobertura que aponta para artefato, não para prosa |

---

## 3. Objetivos e não-objetivos

### Objetivos

| OBJETIVO | MEDIDA |
|---|---|
| Tornar linhagem reconstruível sem perguntar | Share de versões de modelo com caminho completo até dataset |
| Fazer o model card cair do registro, não da mão | Share de fichas geradas vs. digitadas |
| Separar acesso a dado de treino do papel de admin | Acessos ao LAB por quem tem capability, não por quem é ADMIN |
| Produzir evidência de auditoria como subproduto | Itens do pacote de evidência exportáveis sem trabalho manual |
| Saber o que está servindo em produção | Versões de modelo com destino registrado |

### Não-objetivos

- **Não hospeda nem executa modelo.** Treino e inferência rodam fora. O LAB
  registra que rodaram, com que entrada, e com que resultado.
- **Não é MLOps.** Não substitui a plataforma de treino, não agenda job, não
  gerencia GPU. Recebe o fato consumado.
- **Não é o Charter.** O Charter mede o cliente contra regulação. O LAB é o
  registro da Nebuloz sobre si — pode virar prova dentro do Charter, não o
  contrário.
- **Não é feature de cliente.** Nada disso aparece no Cosmos. O que atravessa a
  fronteira é o model card publicado, e só quando alguém decide publicar.
- **Não julga o modelo.** Registra a avaliação que rodou; não afirma que o
  modelo é bom. Nota agregada de qualidade é decisão humana, não campo.

---

## 4. As seis telas

**Modelo próprio** — Inventário. Cada modelo, suas versões, e qual delas está
servindo o quê. É a tela que responde "o que temos rodando".

**Datasets** — O que entrou. Versão, origem, classificação do dado e licença.
Sem classificação, um dataset não vira treino.

**Treinos** — A execução: que versão de dataset, que hiperparâmetro, quanto
custou, e o que produziu. Registro do que rodou fora, não gatilho para rodar.

**Avaliações** — A medição. Suíte, métrica e resultado por versão de modelo.
Uma versão sem avaliação não recebe ficha.

**Linhagem** — O caminho dataset → treino → versão → avaliação, percorrido nos
dois sentidos. É **derivado**, não gravado: linhagem digitada é linhagem que
mente quando alguém esquece de atualizar.

**Model card** — A ficha. Gerada do registro, com os campos que só pessoa
escreve — uso pretendido, limitações conhecidas, população afetada — marcados
como tal.

> **RESTRIÇÃO DURA**
> O model card **não é formulário**. Tudo que pode sair de dataset, treino e
> avaliação sai de lá; o que exige julgamento humano é campo separado e
> visivelmente separado. Ficha inteiramente digitada envelhece no primeiro
> retreino, e a data é a primeira coisa que um auditor confere.

### O que uma operação de LAB carrega

| | |
|---|---|
| **Capability própria** — `lab` não deriva de ADMIN | **Classificação de dado** — dataset sem classe não vira treino |
| **Linhagem derivada** — do FK, nunca de campo digitado | **Trilha append-only** — mesma do back-office, mesmo `AuditLog` |

---

## 5. Requisitos

Prioridade: **P0** necessário para o LAB existir · **P1** dentro de dois
trimestres · **P2** desejável.

| ID | REQUISITO | PRI |
|---|---|---|
| L-01 | Inventário de modelo com versões e destino de cada uma | P0 |
| L-02 | Dataset versionado, com origem, licença e classificação de dado | P0 |
| L-03 | Registro de treino ligando versão de dataset a versão de modelo | P0 |
| L-04 | Avaliação com métrica e resultado por versão de modelo | P0 |
| L-05 | Capability `lab` concedida à parte do papel, verificada no servidor | P0 |
| L-06 | Linhagem derivada da relação, sem campo gravado | P0 |
| L-07 | Toda escrita do LAB na trilha append-only existente | P0 |
| L-08 | Model card gerado do registro, com campos humanos separados | P1 |
| L-09 | Dataset sem classificação não pode virar treino, barrado no servidor | P1 |
| L-10 | Export de pacote de evidência (registros, avaliações, fichas) | P1 |
| L-11 | Cobertura de requisito do Charter apontando para artefato de LAB | P1 |
| L-12 | Publicação de model card para fora, com versão e data | P1 |
| L-13 | Ingestão do resultado de treino por API, não por formulário | P2 |
| L-14 | Alerta de versão servindo em produção sem avaliação vigente | P2 |
| L-15 | Retenção e descarte de dataset por classificação | P2 |

---

## 6. Critérios de sucesso

- Dada uma versão de modelo, alguém de fora da engenharia percorre até o dataset
  de origem sem abrir código.
- A pergunta "esse modelo viu dado de cliente?" tem resposta em uma tela.
- Um model card sai atualizado sem ninguém redigitar o que o registro já sabe.
- Um staff ADMIN do painel **não** vê dado de treino sem a capability.
- Um pedido de due diligence é respondido com export, não com reunião.
- Um dataset sem classificação de dado não chega a um treino.

---

## 7. Riscos

| RISCO | MITIGAÇÃO |
|---|---|
| Vira formulário que ninguém preenche | Ingestão por API (L-13); registro como subproduto do treino |
| Linhagem incompleta pior que ausente | Versão sem treino ligado aparece como lacuna explícita, nunca como completa |
| Model card publicado envelhece calado | Data e versão no artefato; alerta de versão sem avaliação vigente |
| Capability vira formalidade | `lab` não deriva de `role`, com teste que impede derivar |
| Dado de cliente entra em dataset sem passar por decisão | Classificação obrigatória antes do treino, barrada no servidor |
| Escopo escorrega para MLOps | Não-objetivo explícito: o LAB recebe o fato, não dispara o job |
| Citação normativa errada vira problema jurídico | Mapeamento normativo revisado por jurídico antes de ir a cliente |

---

## 8. Dependências

| DEPENDE DE | NATUREZA |
|---|---|
| Back-office | Guard, trilha, shell e a capability que o LAB exige |
| `@repo/provisioning` | Porta única de escrita, com auditoria embutida |
| `@repo/auth` | Sessão, papel e o campo que carrega a capability |
| `@repo/storage` | Referência a artefato e snapshot de dataset |
| Charter | Consumidor: cobertura de requisito que aponta para artefato de LAB |
| Plataforma de treino (externa) | Fonte do fato registrado — fora deste escopo |

---

## 9. Questões em aberto

- **Granularidade da capability.** `lab` é um booleano ou tem leitura e escrita
  separadas, como o painel? Dataset com dado de cliente sugere que sim.
- **Snapshot de dataset.** Guardar o dado, ou só o ponteiro e o hash? A resposta
  muda custo de storage e a força da prova.
- **Fronteira com o Charter.** Um artefato de LAB responde requisito do Charter
  para a Nebuloz. Vale abrir isso para o cliente registrar os modelos dele —
  o que transformaria o LAB em produto?
- **Modelo de terceiro.** Hoje o registro assume modelo próprio. Uso de modelo
  de fornecedor (já coberto por `CharterVendor`) precisa de linhagem também?
- **Publicação.** Model card publicado mora onde — no site, no Cosmos do
  cliente, ou num link assinado por pedido?

---

*Draft para revisão interna. Documento companheiro: LAB SRD v1.0.*
