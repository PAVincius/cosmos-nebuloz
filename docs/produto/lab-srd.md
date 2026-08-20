# LAB — Software Requirements Document

> **PRODUCT** LAB (modelo próprio) · **COMPANION** [LAB PRD v1.0](./lab-prd.md)
> **STATUS** Engineering draft · **VERSION** 1.0 · **AUDIENCE** Engenharia, Segurança, Compliance

Especificação do registro de modelo próprio: capability separada, entidades de
dataset, treino, avaliação e versão, linhagem derivada e model card gerado.

---

## 1. Escopo

Especifica o software do LAB: as entidades de registro, o portão de acesso que
as protege, a derivação de linhagem, a geração de model card e o export de
evidência. O LAB é uma seção do `apps/backoffice` — reusa guard, shell, trilha e
`@repo/provisioning`, e não é aplicação nova.

**Fora de escopo:** execução de treino e de inferência (rodam fora, o LAB recebe
o fato), agendamento de job, gestão de recurso computacional, e qualquer
funcionalidade exposta ao cliente no Cosmos.

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| Modelo | Uma família com propósito e responsável — não um arquivo |
| Versão de modelo | Um artefato concreto, produzido por um treino |
| Dataset | Uma fonte de dado nomeada, classificada e licenciada |
| Versão de dataset | Um recorte imutável de um dataset, com hash |
| Treino | O fato de uma versão de dataset ter produzido uma versão de modelo |
| Avaliação | Uma suíte de métricas aplicada a uma versão de modelo |
| Linhagem | Caminho **derivado** versão ↔ treino ↔ dataset — nunca campo |
| Model card | Ficha de uma versão, gerada do registro mais campos humanos |
| Capability `lab` | Permissão concedida à parte do papel, sem derivar de `role` |

---

## 2. Arquitetura

```
              ┌───────────────────────┐
              │  requirePlatformStaff │  sessão · 2FA · papel · teto
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │    requireLabAccess   │  capability, NÃO derivada de role
              └───────────┬───────────┘
     ┌──────────┬─────────┼─────────┬──────────┐
     ▼          ▼         ▼         ▼          ▼
┌─────────┐ ┌────────┐ ┌──────┐ ┌───────┐ ┌──────────┐
│Datasets │ │Treinos │ │Avali-│ │Linha- │ │  Model   │
│ e ver-  │ │        │ │ações │ │ gem   │ │  card    │
│  sões   │ │        │ │      │ │(deriv)│ │ (gerado) │
└────┬────┘ └───┬────┘ └──┬───┘ └───┬───┘ └────┬─────┘
     └──────────┴─────────┼─────────┴──────────┘
                          ▼
            ┌─────────────────────────┐
            │  @repo/provisioning     │  porta única de escrita
            │  (audita toda operação) │
            └────────────┬────────────┘
                         ▼
            ┌─────────────────────────┐
            │  PostgreSQL · Prisma    │
            └────────────┬────────────┘
                         ▼
              ┌──────────┬──────────┐
              ▼          ▼          ▼
          @repo/      Charter    Export de
          storage   (cobertura)  evidência
        (artefato)
```
*FIGURA 1 — DOIS PORTÕES EM SÉRIE. SER STAFF NÃO É SER DO LAB.*

| COMPONENTE | RESPONSABILIDADE |
|---|---|
| `lib/lab-guard.ts` | `requireLabAccess` — capability, depois do guard de staff |
| `lib/lineage.ts` | Derivação de linhagem a partir das relações, sem cache gravado |
| `lib/model-card.ts` | Montagem da ficha: derivado + campos humanos, separados |
| `app/actions/lab-*.ts` | Server actions por entidade, todas atrás dos dois portões |
| `@repo/provisioning` | Escrita e auditoria — o LAB não escreve direto |

---

## 3. Modelo de dados

```
LabDataset ──1:N── LabDatasetVersion
                          │
                          │ 1:N
                          ▼
LabModel ──1:N── LabTrainingRun ──1:1── LabModelVersion
   │                                          │
   │                                     ┌────┴────┐
   │                                1:N  ▼         ▼ 1:1
   │                        LabEvaluationResult  LabModelCard
   │                                  ▲
   │                             N:1  │
   └────────────────────  LabEvaluation

LabModelVersion ──1:N── LabDeployment   (o que serve o quê)
```
*FIGURA 2 — LINHAGEM É ESTE GRAFO PERCORRIDO, NÃO UMA TABELA.*

| ENTIDADE | CAMPOS-CHAVE |
|---|---|
| `LabDataset` | `id`, `nome`, `origem`, `licenca`, **`classificacao`**, `responsavelId` |
| `LabDatasetVersion` | `id`, `datasetId`, `versao`, **`hash`**, `linhas`, `uri`, `criadoEm` |
| `LabModel` | `id`, `nome`, `proposito`, `responsavelId`, `postura` |
| `LabTrainingRun` | `id`, `modelId`, `datasetVersionId`, `hiperparametros`, `custo`, `runUri`, `iniciadoEm`, `terminadoEm` |
| `LabModelVersion` | `id`, `modelId`, `trainingRunId`, `versao`, `artefatoUri`, `criadoEm` |
| `LabEvaluation` | `id`, `nome`, `suite`, `definicaoMetrica` |
| `LabEvaluationResult` | `id`, `evaluationId`, `modelVersionId`, `metrica`, `valor`, `executadoEm` |
| `LabModelCard` | `id`, `modelVersionId`, `usoPretendido`, `limitacoes`, `populacaoAfetada`, `geradoEm`, `publicadoEm` |
| `LabDeployment` | `id`, `modelVersionId`, `destino`, `desde`, `ate` |

**Não existe tabela de linhagem, nem campo `statusTreino`, nem nota agregada de
qualidade.** Os três são derivados, e a ausência é a especificação — pelo mesmo
motivo que o back-office não grava `health`. Linhagem gravada diverge do grafo
no primeiro retreino, e o sintoma é uma tela afirmando procedência errada sem
erro, sem log e sem métrica.

**`LabModelCard` guarda apenas o que só pessoa escreve.** Métrica, dataset,
data e versão não moram ali: são lidos na montagem. Copiá-los para a ficha é
criar a segunda cópia que envelhece.

---

## 4. O portão

`requireLabAccess` roda **depois** de `requirePlatformStaff`, nunca no lugar
dele. São perguntas diferentes: a primeira é "isto é staff?", a segunda é "este
staff pode ver dado de treino?".

```
        ┌──────────────┐
        │ PlatformStaff│  (guard do back-office já passou)
        └──────┬───────┘
               ▼
        ┌──────────┐  sem capability  ┌───────────┐
        │labAccess │─────────────────▶│ FORBIDDEN │──▶ "acesso ao LAB
        └────┬─────┘                  └───────────┘     é concedido à parte"
             │ tem
             ▼
        ┌──────────┐  escrita e só lê ┌───────────┐
        │ canWrite │─────────────────▶│ FORBIDDEN │
        └────┬─────┘                  └───────────┘
             ▼  LabStaff { canWrite, labAccess }
```
*FIGURA 3 — DOIS PORTÕES, DUAS PERGUNTAS. ADMIN NÃO ABRE O SEGUNDO.*

| ID | REQUISITO DE PORTÃO |
|---|---|
| LG-01 | Toda server action de LAB chama `requirePlatformStaff` **e** `requireLabAccess` |
| LG-02 | `labAccess` é campo próprio em `TenantMember`, e não deriva de `role` |
| LG-03 | Há teste que falha se ADMIN passar a implicar `labAccess` |
| LG-04 | Conceder e revogar `labAccess` é operação auditada |
| LG-05 | Leitura de dataset e de versão de dataset é registrada, não só escrita |
| LG-06 | UI escondida não é controle: a checagem é servidor, como no painel |

> **INVARIANTE CRÍTICA**
> `labAccess` deriva de `role` é o furo que a capability existe para fechar.
> Se ADMIN implicar LAB, o dado de treino passa a ser visível para todo mundo
> que provisiona tenant — e a separação vira decoração, com o agravante de a
> auditoria exibir um controle que não controla.

---

## 5. Linhagem e model card

Duas derivações, ambas sem estado próprio.

**Linhagem** percorre o grafo da FIGURA 2 nos dois sentidos: de uma versão de
modelo até os datasets que a formaram, e de um dataset até tudo que ele tocou.
O segundo sentido é o que responde à pergunta cara — *"esse dataset saiu; que
modelos preciso reavaliar?"*.

**Model card** monta a ficha na leitura:

| SEÇÃO DA FICHA | ORIGEM |
|---|---|
| Identificação, versão, data | `LabModelVersion` |
| Dado de treino, licença, classificação | `LabDatasetVersion` → `LabDataset` |
| Procedimento e custo | `LabTrainingRun` |
| Desempenho medido | `LabEvaluationResult` |
| Onde está servindo | `LabDeployment` |
| **Uso pretendido** | Humano — `LabModelCard` |
| **Limitações conhecidas** | Humano — `LabModelCard` |
| **População afetada** | Humano — `LabModelCard` |

| ID | REQUISITO |
|---|---|
| LM-01 | Nenhum campo derivado é copiado para `LabModelCard` |
| LM-02 | Campo humano vazio aparece como lacuna, nunca é preenchido por padrão |
| LM-03 | Versão sem avaliação não gera ficha publicável |
| LM-04 | Ficha publicada carrega versão e data de geração no próprio artefato |
| LM-05 | Linhagem incompleta é exibida como incompleta, com o elo que falta nomeado |

---

## 6. Interfaces

| INTERFACE | DIREÇÃO | PROPÓSITO |
|---|---|---|
| Back-office (guard, shell, trilha) | In | Sessão, papel, segundo fator, teto, `AuditLog` |
| `@repo/provisioning` | Out | Porta única de escrita, com auditoria embutida |
| `@repo/storage` | Out | Artefato de modelo e snapshot de dataset |
| Plataforma de treino (externa) | In | Fato do treino — por API (L-13), não por formulário |
| Charter | Out | `CharterCoverage` apontando para artefato de LAB |
| Export de evidência | Out | Pacote para auditoria de cliente ou certificação |

---

## 7. Requisitos não-funcionais

| ID | REQUISITO |
|---|---|
| LN-01 | Toda escrita passa por `@repo/provisioning` e entra na trilha append-only |
| LN-02 | Leitura de dataset e de artefato registrada — quem olhou o quê |
| LN-03 | `uri` de artefato nunca vira link direto: acesso passa por assinatura curta |
| LN-04 | `hash` de versão de dataset é obrigatório — sem ele não há prova |
| LN-05 | Versão de dataset é imutável após criada; correção é versão nova |
| LN-06 | Linhagem de um modelo com centenas de treinos resolve em consulta única |
| LN-07 | Export de evidência é assíncrono e auditado, nunca síncrono na request |
| LN-08 | Nenhum dado de treino atravessa para o Cosmos por qualquer caminho |

> **CUIDADO COM A FRONTEIRA**
> O LAB vive no mesmo banco e no mesmo `AuditLog` do resto. O que o separa é o
> portão, não o isolamento físico — e isso significa que qualquer consulta nova
> que esqueça `requireLabAccess` abre tudo. É por isso que LG-01 é regra de
> teste, não convenção.

---

## 8. Restrições e premissas

- O LAB registra o fato consumado. Se o treino roda e ninguém registra, o LAB
  não tem como saber — daí L-13 (ingestão por API) ser o caminho, e o formulário
  ser a ponte até lá.
- O volume cresce com número de treinos e de avaliações, não com número de
  pessoas. A otimização segue esse eixo.
- Snapshot de dataset pode ser ponteiro + hash em vez do dado — decisão em
  aberto no PRD, e o schema acomoda os dois (`uri` + `hash`).
- Modelo de terceiro não entra nesta versão. Fornecedor já tem `CharterVendor`;
  unificar os dois é decisão de produto, não de engenharia.
- Nenhuma rota de LAB volta ao menu do back-office antes de o schema existir.
  Foi por prometer sem entidade que as seis saíram.

---

## 9. Mapeamento normativo

O LAB não é feito para cumprir norma — é feito para a Nebuloz saber o que
treinou. A tabela mostra o que cada artefato serve, quando alguém perguntar.

| ARTEFATO DO LAB | SERVE A |
|---|---|
| `LabDataset.classificacao`, licença, origem | AI Act Art. 10 (dado e governança de dado) |
| Linhagem derivada, `LabTrainingRun` | AI Act Art. 11 e Anexo IV (documentação técnica) |
| `AuditLog` do LAB, append-only | AI Act Art. 12 (registro); LGPD Art. 37 |
| `LabModelCard` publicado | AI Act Art. 13 (informação ao deployer) e Art. 50 (transparência) |
| `LabEvaluationResult` | AI Act Art. 15 (acurácia e robustez) |
| Pacote de evidência (L-10) | ISO/IEC 42001 — Anexo A, 38 controles, objetivos A.2 a A.10 |
| Registro completo como processo repetível | NIST AI RMF 1.0 — MAP, MEASURE, MANAGE |

> **REVISÃO JURÍDICA OBRIGATÓRIA**
> Estas referências foram escritas por engenharia e servem para orientar
> desenho, não para ir a cliente. Citação que aponta para o artigo errado é a
> primeira coisa que um auditor confere, e erra pior do que citação ausente.
> Nada desta tabela sai da Nebuloz sem passar por jurídico.

---

## 10. Critérios de aceite

- Um staff ADMIN sem `labAccess` recebe FORBIDDEN em toda action de LAB,
  verificado por teste.
- Nenhum caminho de código concede `labAccess` a partir de `role`, verificado
  por teste.
- Dada uma versão de modelo, a linhagem até os datasets de origem é obtida sem
  campo gravado e sem consulta em laço.
- Dado um dataset, a lista de versões de modelo que o consumiram é obtida.
- Uma versão sem avaliação não produz ficha publicável.
- Um `LabModelCard` não contém nenhum campo que o registro já sabe.
- Uma versão de dataset criada não pode ser alterada; a correção vira versão
  nova, e as duas aparecem na linhagem.
- A leitura de um dataset por um staff aparece no registro de acesso.

---

*Engineering draft. Documento companheiro: LAB PRD v1.0.*
