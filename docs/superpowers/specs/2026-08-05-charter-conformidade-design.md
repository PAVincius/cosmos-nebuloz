# Charter — Mapa de conformidade sobre evidência viva

**Data:** 2026-08-05
**Status:** desenhado, aguardando plano de implementação
**Origem:** validação a partir de exigência real (`rfp-aurora-mesh-ai.pdf`)

---

## 1. Por que este trabalho existe

O Charter compete num mercado cheio — governança de IA tem OneTrust, Credo AI,
Holistic AI, watsonx.governance e os pacotes de compliance genérico. Quase todo
concorrente vende a mesma coisa: **sistema de registro**. Você cadastra política,
caso de uso, fornecedor e decisão, e depois prova a conformidade sozinho, na mão.

A validação partiu de uma exigência escrita, não de tese. A RFP da Aurora Mesh
pede, em §7.2, exatamente isto:

> *Mapa de aderência — tabela mapeando cada requisito desta RFP para capacidades
> concretas da solução ("Atende", "Atende parcialmente", "Não atende"), com
> comentários.*

O artefato que valida o produto e o artefato que o vende são o mesmo. E a mesma
máquina resolve uma dor maior do lado do cliente: toda empresa enterprise recebe
questionário de segurança e de IA dos próprios clientes, e responder isso hoje é
semanas de planilha alimentada por memória.

### O que a validação encontrou

Mapeamento feito contra o schema e as actions, não contra memória.

| Exigência da RFP | Situação | Evidência no código |
|---|---|---|
| §4.1.3 estados do workflow (6 pedidos) | **Atende** | `CharterUseCaseStatus` tem 8 e cobre os 6 |
| §4.1.3 registro de decisão | **Atende** | `CharterDecision`: `deciderId`, `createdAt`, `conditions[]`, `rationale` |
| §4.1.4 versionamento com diff | **Atende** | `CharterPolicyVersion.snapshot`, `changeCount`, `getVersionDiff` |
| §4.1.5 attestation + revalidação | **Atende** | `CharterAcknowledgment.policyVersionId` |
| §4.1.2 matriz de risco | **Parcial** | 7 dimensões (cobre as 5 pedidas), mas score único e colunas fixas |
| §4.1.2 risco → aprovação | **Parcial** | `previewPath` recomenda por 3 eixos; a RFP quer amarração |
| §6.5 formatos de export | **Parcial** | CSV e JSON; **sem PDF** |
| §4.1.4 e §4.3.2 política ↔ caso ↔ vendor | **Não atende** | `CharterPolicy` não tem relação com `CharterUseCase` nem `CharterVendor` |
| §6.3 dado sensível em prompt/log | **Não atende** | controle de runtime; Charter é registro |
| §6.4 bloqueio rápido em incidente | **Não atende** | registra `blockReason`; não impede |

Duas ressalvas que ficam registradas:

**O documento se declara genérico** no cabeçalho — *"RFP genérico, utilizado por
empresa enterprise"*. É molde válido de exigência, não prova de negócio assinado.

**O escopo dele não é o Charter.** §3.1, §4.2 e §4.4 (portfólio de iniciativas,
ROI com baseline, dashboards, integrações) são Cosmos. Os pesos dão 30% a
"portfólio **+** governança" e 25% a maturidade de governança — Charter sozinho
não responde a RFP.

---

## 2. Decisão de aposta

A RFP mostra o Charter forte em **registrar** e ausente em **impedir**. Havia
duas apostas possíveis e escolhemos a terceira via: **fechar as parciais agora, e
manter a aposta de enforcement em aberto até haver evidência que a sustente.**

**Por que não enforcement agora.** Impedir exige o Charter estar no caminho da
chamada de IA, não ao lado dela. Virar gateway é outro produto, com orçamento de
latência, SLA próprio e um modo de falha novo: Charter fora do ar significa IA do
cliente parada. Isso não se compromete com base em um documento genérico.

**Por que não só "máquina de evidência".** É o terreno onde todo concorrente
joga. Ganha negócio, não cria distância.

**Por que fechar as parciais.** Têm evidência na mão e custo baixo. O vínculo
política↔caso↔vendor é citado em dois pontos distintos da RFP e simplesmente não
existe — a melhor razão citação/custo do mapa inteiro.

A pesquisa de concorrente continua, como validação, e é ela que decide a aposta
grande. **Este spec não a encerra.**

---

## 3. Escopo

**Dentro.** Registro de exigências importadas de um documento; **regulação como
conjunto versionado publicado pela Nebuloz** (AI Act, LGPD, NIST AI RMF, ISO/IEC
42001) com propagação de mudança para as coberturas afetadas; vínculo exigência →
capacidade do Charter → artefato de evidência; geração do mapa em tela, CSV, JSON
e PDF; fundamento citado em rascunho gerado por modelo; e as parciais que a RFP
cita: vínculo política↔caso↔vendor, export PDF, probabilidade na matriz de risco.

**Fora, deliberadamente.** Enforcement em runtime (§6.3, §6.4). Detecção
automática de viés (§6.2). Portfólio e ROI (§4.2) — são Cosmos. Matriz de risco
*configurável* — dimensão como dado em vez de coluna é redesenho de schema, e a
RFP já é atendida na parte que pontua ("ao menos" 5 dimensões; Charter tem 7).
Fica anotado como lacuna conhecida.

**Parser automático de PDF está fora, e é decisão, não preguiça.** Extração
automática erra em documento com numeração irregular, e errar aqui significa
responder ao comprador uma exigência que ele não fez. Colar é chato uma vez;
errado é caro toda vez.

---

## 4. Arquitetura

### 4.1 Modelos novos

```
CharterRequirementSet  { tenantId?, nome, origem: RFP|REGULACAO, editor: TENANT|NEBULOZ,
                         jurisdicao?, versao, supersedesId?, licenca: LIVRE|REFERENCIA,
                         importadoEm, notas }
CharterRequirement     { setId, codigo, citacao, resumo, texto?, peso?, categoria? }
                       @@unique([setId, codigo])
CharterCoverage        { tenantId, requirementId, status, comentario, capabilityId? }
                       @@unique([requirementId])
CharterPolicyLink      { tenantId, policyId, alvoTipo: USE_CASE|VENDOR, alvoId }
                       @@unique([policyId, alvoTipo, alvoId])
```

`tenantId` é opcional em `CharterRequirementSet`: conjunto de regulação é
publicado pela Nebuloz e compartilhado por todos os tenants; conjunto de RFP é do
tenant que o importou. Nulo significa global.

`status` ∈ `ATENDE | PARCIAL | NAO_ATENDE | SEM_VEREDITO`.

**Uma cobertura por exigência**, garantido no banco e não só na tela. Duas
coberturas para a mesma linha significam dois vereditos contraditórios indo para
o mesmo comprador, e a tela teria de escolher um — escolha que ninguém fez. Por
isso `setCoverage` é upsert sobre `requirementId`, não insert.

O `@@unique([setId, codigo])` é o que faz a recusa por código duplicado de §6 ser
garantia, não validação que dá para contornar por outra porta.

`CharterUseCase` ganha colunas `prob*` ao lado das `risk*` existentes, virando
matriz impacto × probabilidade em vez de score único.

### 4.2 A ideia central: catálogo de capacidades em código

A cobertura **não** guarda o texto da evidência. Ela aponta para uma
**capacidade**, e a capacidade sabe buscar a própria evidência.

```ts
type Capability = {
  id: "POLICY_VERSIONING" | "POLICY_ATTESTATION" | "DECISION_RECORD"
    | "VENDOR_TIER" | "AUDIT_EXPORT" | "RISK_SCORING" | "POLICY_LINK";
  label: string;
  /** Roda contra o dado real do tenant. Devolve contagem, amostra e link. */
  evidencia: (tenantId: string) => Promise<{
    total: number;
    amostra: string[];
    href?: string;
  }>;
};
```

`POLICY_ATTESTATION` não responde "sim"; responde *"37 aceites registrados, o
mais recente em 12/07, vinculados à versão 2.1"*.

**A evidência fica viva.** O mapa relê o dado a cada abertura, em vez de ser
gerado uma vez e apodrecer.

**Por que o catálogo mora em código.** Catálogo em banco vira ficção: alguém
cadastra capacidade que o código não tem e o mapa mente para o comprador. Em
código, um teste roda a consulta de cada capacidade contra o schema — se o
`policyVersionId` sumir do aceite, o teste quebra antes de o produto alegar.

### 4.3 Regulação é um conjunto de exigências, não um corpus para RAG

A RFP §6.1 pede como a solução considera marcos regulatórios e **processo para
atualização contínua**. A forma óbvia — jogar os PDFs num índice e deixar o
modelo consultar — é a errada, por três razões.

Faz o produto **afirmar conformidade**, quebrando o limite de §5 e criando
exposição jurídica justamente no cliente que comprou governança para reduzi-la.
Corpus desatualizado **cita com confiança artigo revogado**, o que é pior que não
citar. E saída de RAG **não é verificável**, enquanto todo o resto do design se
apoia em evidência checável.

Regulação entra como `CharterRequirementSet` com `origem: REGULACAO` e
`editor: NEBULOZ` — estruturalmente idêntica à RFP da Aurora Mesh. O cliente
mapeia a evidência dele **uma vez** e ela responde às duas.

**Corpora do primeiro corte:**

| Conjunto | Jurisdição | Licença |
|---|---|---|
| EU AI Act — obrigações de sistemas de alto risco | UE | `LIVRE` |
| LGPD — tratamento e decisão automatizada | BR | `LIVRE` |
| NIST AI RMF 1.0 | US | `LIVRE` |
| ISO/IEC 42001 — objetivos de controle | Internacional | `REFERENCIA` |

**A licença é estrutural, não regra que alguém lembra.** ISO/IEC 42001 é norma
proprietária: reproduzir o texto das cláusulas é infração de copyright. Por isso
`CharterRequirement` separa três campos — `citacao` (sempre: "Art. 9º", "cláusula
6.1.2"), `resumo` (sempre: formulação nossa do objetivo) e `texto` (**apenas**
quando `licenca = LIVRE`). Conjunto `REFERENCIA` com `texto` preenchido é
recusado no banco e no teste, não no code review.

**Atualização contínua** usa o mecanismo que o Charter já tem para política:
versão nova é um conjunto com `supersedesId` apontando para o anterior. Publicar
computa o diff por `codigo` — adicionadas, alteradas, removidas — e marca as
coberturas cujo requisito mudou como `REVISAR`. O cliente vê o que a mudança
regulatória afetou **na governança dele**, em vez de receber um aviso genérico de
que a lei mudou.

### 4.4 O papel do modelo, delimitado

O modelo **sugere** mapeamento por proximidade de texto e **redige** rascunho de
seção de política fundamentado numa cláusula citada. Ele não afirma cumprimento e
não decide status de cobertura.

Hoje `saveGeneratedDraft` grava `generated: true` e **não registra o que
fundamentou a geração** — texto de política nasce sem citação e sem rastro. Este
trabalho fecha isso: `CharterPolicySection` ganha `groundedRequirementId`, e
rascunho gerado sem fundamento passa a ser estado inválido, não default.

### 4.5 Onde mora

**No Charter, virado para o tenant** — não no back-office como ferramenta de
venda. A dor do cliente (responder questionário que ele recebe) é maior e mais
frequente que a nossa. A Nebuloz responde a RFP da Aurora Mesh usando o próprio
produto — dogfooding que vira o caso de referência que §7.4 pede.

Tela `/charter/conformidade`: lista de conjuntos e detalhe do mapa.

Actions no padrão que o Charter já usa (`Result<T>`, guard de tenant,
`logCharterAudit`): `listRequirementSets`, `importRequirementSet`, `setCoverage`,
`getComplianceMap`, `exportComplianceMap`.

### 4.6 PDF

`@react-pdf/renderer`. Sem navegador headless, sem binário extra, roda em função
serverless sem estourar bundle. Layout é mais limitado que HTML — e relatório de
auditoria é tabela e texto, que é o que ele faz bem.

---

## 5. Fluxo

1. **Importar** — colar exigências, uma por linha, com código e texto.
2. **Mapear** — por exigência, escolher status e apontar capacidade. A tela
   sugere por palavra-chave; **quem decide é a pessoa**.
3. **Gerar** — tela, CSV, JSON, PDF; cada "atende" com a evidência viva.

**Limite explícito do produto.** Ele não decide se você atende. Registra o que
uma pessoa afirmou e anexa a prova que existe no dado. Afirmação de conformidade
sem responsável é o que transforma auditoria em problema jurídico.

---

## 6. Erro

O modo de falha que importa é **o mapa mentir**. O resto é secundário.

| Situação | Resposta |
|---|---|
| Consulta de evidência falha | Linha degrada para *"evidência indisponível"* com o motivo — **nunca** segue mostrando "atende" limpo |
| Cobertura aponta capacidade removida | *"capacidade removida — revise"*, não em branco |
| Importação com código duplicado | Recusa nomeando a linha ofensora — adivinhar qual vale é escolher pelo usuário |
| Export com mapa incompleto | **Não** bloqueia (rascunho é uso legítimo); cabeçalho diz *"12 de 47 sem veredito"* |
| Falha ao gerar PDF | Devolve erro; **não** cai calada para CSV |
| Conjunto de outro tenant | Não encontrado, sem distinguir "não existe" de "não é seu" |

---

## 7. Teste

**O teste de contrato de capacidade sustenta o design.** Para cada entrada do
catálogo, roda a consulta de evidência contra o schema real. Se um campo sumir, o
teste quebra e o produto perde a capacidade de alegar antes de alegar errado.

Mesmo princípio do `cosmos:graph check`, que reprova nó apontando para arquivo
inexistente. Sem ele o catálogo vira a planilha desatualizada que este trabalho
veio substituir.

**A guarda de copyright é teste, não disciplina.** Um teste percorre todo
conjunto com `licenca = REFERENCIA` e falha se qualquer requisito tiver `texto`
preenchido. Reproduzir cláusula de ISO/IEC 42001 é infração, e infração não pode
depender de alguém lembrar disso no code review — nem do próximo que for
cadastrar um conjunto novo.

Somam-se: validação de importação com código duplicado; contagem de não-mapeados
no cabeçalho do export; isolamento de tenant; diff de versão de conjunto marcando
as coberturas certas como `REVISAR`; recusa de rascunho gerado sem
`groundedRequirementId`; e render tests cobrindo evidência presente, evidência
indisponível e mapa incompleto.

**Verificação:** rodar com o comando real do pacote (`pnpm --filter app test`),
contra o resultado mergeado com a `main` — não contra a branch isolada. Conflito
semântico entre branches não aparece de outro jeito.

---

## 8. Lacunas conhecidas

Registradas para não serem redescobertas como surpresa:

- Matriz de risco **configurável** (dimensão como dado) — adiada com razão em §3.
- **Enforcement** (§6.3, §6.4) — aposta em aberto, dependente da pesquisa de
  concorrente.
- Charter **não responde a RFP sozinho** — §3.1, §4.2 e §4.4 são Cosmos.
- Curadoria dos quatro corpora é **trabalho editorial recorrente**, não código.
  Sem alguém dono disso, o conjunto envelhece e passa a citar norma revogada —
  que é exatamente a falha que este desenho existe para evitar.
- A validação apoia-se em **um** documento, e genérico. Mais documentos mudam a
  prioridade; este spec não encerra a fase de validação.
