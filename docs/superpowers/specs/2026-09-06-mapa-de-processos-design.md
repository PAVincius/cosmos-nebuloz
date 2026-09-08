# Mapa de processos — design (subprojeto C)

Tela nova em Ferramentas, a partir do design `backoffice-process-map.jsx` +
`backoffice-process-map-screen.jsx` (projeto Claude Design 691f7fe5). O grafo
de conhecimento aplicado aos processos da casa: cada nó é um processo, cada
aresta é o que dispara, alimenta ou exige o outro.

Decisões já tomadas com o usuário (aprovadas em 2026-09-06): entidade própria
(`StaffProcess`/`StaffProcessEdge`), canvas com pan/zoom e export JSON Canvas
na v1, **sem fontes externas** (Drive/Notion/GitHub/SharePoint ficam fora; o
único "modelo" é o BPMN já versionado em `StaffDiagram`), e **adicionar e
excluir processos** pela tela.

## 0. Escopo e cortes (ponytail)

Entra: nós e arestas no banco (tenant `system`), grafo SVG com layout polar
(domínio = setor, nível = anel), pan/zoom/enquadrar, hover abre o nome, clique
seleciona e realça vizinhos, painel do nó, busca por texto, filtros por
domínio/nível/status, criar/editar/excluir processo, criar/excluir ligação,
exportar `.canvas`, seed dos 21 processos e 23 ligações do design.

Fica fora, com o motivo:

| Cortado | Por quê |
|---|---|
| Fontes conectadas (tabela, modal "Conectar fonte") | decisão do usuário: sem integrações. O nó guarda no máximo um `docUrl` (link) |
| Busca semântica com sinônimos e voz | é protótipo; busca por substring em nome+descrição+tags cobre o uso. Embeddings quando houver corpus |
| Poeira estelar animada, "molas", tema do céu (auto/claro/escuro), marquee multi-seleção | cosmético ou de demo; a tela segue o tema da página. Uma mancha desfocada por área permanece — ela é o "nebulosa" da metáfora |
| Posição do nó persistida | o layout polar é determinístico por (domínio, nível); arrastar é temporário e o nó volta para casa ao soltar longe, como no design |
| `status` como coluna | derivado: com BPMN = Modelado; com `docUrl` = Rascunho; senão = Não mapeado. Uma verdade só |

## 1. Dados

Arquivo novo `packages/database/prisma/schema/processos.prisma`.

```prisma
/// Um processo da casa no mapa. Tenant é sempre `system` (artefato da Nebuloz).
model StaffProcess {
  id        String @id @default(cuid())
  tenantId  String
  /// Código curto e estável, "PZ-01". Único por tenant; é o id no .canvas.
  codigo    String
  nome      String
  descricao String @db.Text
  /// COMERCIAL | DELIVERY | GOVERNANCA | PLATAFORMA | LAB | MEDICAO
  dominio   String
  /// 1 estratégico · 2 tático · 3 operacional — decide o anel.
  nivel     Int
  /// CORE | APOIO
  tipo      String
  donoNome  String?
  revisadoEm DateTime?
  tags      String[]
  /// Modelo BPMN que descreve o processo. SetNull: o processo sobrevive ao diagrama.
  diagramId String?
  /// Onde o documento vive quando não há BPMN (link, sem integração).
  docUrl    String?

  criadoEm     DateTime @default(now())
  atualizadoEm DateTime @updatedAt

  diagram  StaffDiagram?      @relation(fields: [diagramId], references: [id], onDelete: SetNull)
  saidas   StaffProcessEdge[] @relation("de")
  entradas StaffProcessEdge[] @relation("para")

  @@unique([tenantId, codigo])
  @@index([tenantId, dominio])
}

/// "de → para: rótulo". Ex.: PZ-01 → PZ-02 "converte em".
model StaffProcessEdge {
  id       String @id @default(cuid())
  tenantId String
  deId     String
  paraId   String
  rotulo   String

  de   StaffProcess @relation("de", fields: [deId], references: [id], onDelete: Cascade)
  para StaffProcess @relation("para", fields: [paraId], references: [id], onDelete: Cascade)

  @@unique([deId, paraId])
  @@index([tenantId])
}
```

`StaffDiagram` ganha `processos StaffProcess[]`. Migration
`20260909000000_mapa_de_processos` com o bloco RLS `DO $$` das duas tabelas,
no padrão de `20260908000000_funil_v2`.

Seed `packages/provisioning/src/processos-nebuloz.ts` (`PROCESSOS_NEBULOZ`,
`LIGACOES_NEBULOZ`): os 21 nós e 23 arestas do design, com `donoNome` do
`owner`, `revisadoEm` da data em extenso (`"—"` → null), `docUrl` null e
`diagramId` null (o vínculo com BPMN é feito pela tela; o design marca `source:
bpmn` mas não existe diagrama correspondente no banco). `seed:empresa:nebuloz`
ganha esta etapa; SQL de produção `packages/database/scripts/2026-09-seed-processos.sql`
(create-only, `ON CONFLICT DO NOTHING`, `SELECT` final esperado `21 | 23`).

## 2. Regras puras — `apps/backoffice/lib/ferramentas/processos.ts`

Sem I/O. Tipos `Processo` (linha do banco com `diagram: {id, nome, slug} | null`)
e `Ligacao`.

- `DOMINIOS`: id → `{ rotulo, tom }` — COMERCIAL amber, DELIVERY blue,
  GOVERNANCA accent, PLATAFORMA purple, LAB green, MEDICAO neutral (neutral
  vira `blue` nos chips, como no funil).
- `NIVEIS`: 1/2/3 → `{ rotulo, curto, descricao }` do design.
- `STATUS`: MODELADO green "BPMN versionado e revisado" · RASCUNHO amber
  "Existe documento, não existe modelo" · NAO_MAPEADO red "Roda na cabeça de
  alguém". `statusDe(p)` = MODELADO se `diagramId`, RASCUNHO se `docUrl`,
  senão NAO_MAPEADO.
- `layoutPolar(processos)` → `{ W, H, cx, cy, aneis, pos }`: porta do
  `PROC_LAYOUT` do design (W 1560, H 940, anéis rx/ry por nível, setor por
  domínio na ordem de `DOMINIOS`, espalhamento em arco e alternância de raio).
  Determinístico: mesma entrada, mesma saída.
- `vizinhos(id, ligacoes)` → `{ outro, dir: "in" | "out", rotulo }[]`.
- `buscar(q, processos)`: tokens ≥ 3 letras, sem stop-words, todos devem bater
  em `nome + descricao + tags` (case/acento-insensível). Vazio → `null` (sem
  filtro). Devolve `{ ids: Set | null, primeiro: id | null }`, ordenado por
  número de campos atingidos.
- `paraJsonCanvas(processos, ligacoes, pos)`: JSON Canvas 1.0 — grupos por
  domínio (retângulo envolvente + 22/34/22/18 de margem, `color` hex do
  domínio), nós `type: "file"` 168×52 centrados em `pos`, `file:
  processos/<codigo>-<slug>.md`, arestas com `fromSide/toSide` pela geometria
  (`ladosDaAresta`), `toEnd: "arrow"`, `label` = rótulo. Cores hex do design
  (`DOMAIN_HEX`) ficam aqui, só para o arquivo exportado — a tela usa tokens.

## 3. Actions — `apps/backoffice/app/actions/processos.ts`

Todas via `safeAction` + `requirePlatformStaff`; escritas com `assertCanWrite`,
`logPlatformAudit`, `revalidatePath("/ferramentas/processos")`; tenant `system`.

- `listarProcessos()` → `{ processos, ligacoes, diagramas: {id, nome, slug}[] }`
  (diagramas BPMN do tenant, para o select do formulário).
- `criarProcesso(input)` / `atualizarProcesso(id, input)`: zod — `codigo`
  `^PZ-\d{2,3}$`, `nome` 2–80, `descricao` 1–500, `dominio` ∈ DOMINIOS, `nivel`
  1–3, `tipo` CORE|APOIO, `donoNome` ≤ 60 opcional, `revisadoEm` `z.iso.date()`
  opcional, `tags` ≤ 12 itens de ≤ 30, `diagramId` opcional (deve existir no
  tenant e ser BPMN), `docUrl` `z.url()` opcional. Código duplicado → erro
  "Já existe PZ-xx".
- `excluirProcesso(id)`: apaga o nó; as ligações caem por cascade. Audit
  registra código e nome.
- `criarLigacao({ deId, paraId, rotulo })`: `rotulo` 2–40, `deId !== paraId`,
  ambos do tenant, par único → erro "Ligação já existe".
- `excluirLigacao(id)`.

## 4. Tela — `apps/backoffice/app/(staff)/ferramentas/processos/`

Nav: item "Mapa de processos" (ícone `graph`, adicionado ao kit se faltar)
entre "Modelagem BPMN" e "Diagramas".

- `page.tsx` (server): `requirePlatformStaff` + `listarProcessos`.
  `PageHeader` eyebrow "Ferramentas · mapa de processos", tone `accent`,
  subtítulo do design (sem a frase das fontes), badges: N modelados (green), N
  rascunhos (amber), N não mapeados (red, só se > 0). Ações: link "Abrir
  modelador" → `/ferramentas/bpmn`; `WriteButton` "Novo processo".
- `mapa.tsx` (client root): estado = payload; `recarregar()` após cada escrita;
  busca (input com limpar; linha "N processos para 'q'"), `FiltroChips` ×3
  (domínio, nível, status); grid `1fr 300px` quando há seleção (empilha abaixo
  de 1100px); vazio → `SmartEmptyState`-equivalente com "Limpar".
- `grafo.tsx` (presentational, SVG): fundo pontilhado, 3 anéis com rótulo
  "N · NÍVEL", núcleo, mancha desfocada por área (filtro `feGaussianBlur`, cor
  do token do domínio, opacidade menor quando há seleção), rótulo da área
  "ÁREA · n" (clique seleciona todos da área), arestas retas com seta (entre
  áreas um pouco mais fortes; realçadas + rótulo em pill quando tocam a
  seleção; esmaecidas fora dela), nós = círculo com inicial (raio por grau +
  nível 1), abre em pill com nome e "N2 · Modelado · BPMN v3" em hover/seleção,
  arrastar temporário com retorno para casa se soltar a > 190 px, pan (roda,
  arrasto no fundo, espaço), zoom (⌘/ctrl+roda no cursor; botões +/−/enquadrar
  0.3–3×), `Esc` limpa, `Enter` no nó seleciona, `aria-label="<codigo> <nome>"`.
  Rodapé: "N NÓS · G GRUPOS · A ARESTAS", dica de uso, zoom %. Botão ".canvas"
  no canto → `onExportar()`. Sem animações além das transições CSS do pill;
  respeita `prefers-reduced-motion`.
- `painel.tsx`: header com faixa na cor do domínio, eyebrow "PZ-01 · Comercial
  · nível 2 tático · núcleo", nome, descrição; 4 cartões (Status badge; BPMN:
  "v<n>" onde n = versões do diagrama, ou "sem modelo" amber; Dono; Revisado);
  bloco do documento (link `docUrl` "Abrir" ou "sem documento"); "Ligações · n"
  com seta in/out, nome, rótulo — clique centra e seleciona o outro; botão ×
  por ligação (`podeEscrever`) e "Nova ligação" (mini-form: select do destino
  + rótulo); tags; rodapé: "Abrir no modelador" (link `/ferramentas/bpmn`) ou
  "Modelar agora", "Editar", "Excluir" (confirmação em duas etapas no próprio
  botão: "Excluir" → "Confirmar exclusão", como `confirmar-acao`).
- `processo-dialog.tsx`: criar/editar — código, nome, descrição, chips de
  domínio, nível (3 chips com o `desc` do nível), tipo, dono, revisado em
  (`<input type="date">`), tags (vírgula), diagrama BPMN (select, "nenhum"),
  documento (URL). "Salvar" só com código válido, nome ≥ 2 e descrição.
- Export: `paraJsonCanvas` → `Blob` → download `nebuloz-processos.canvas`;
  aviso inline "N nós · G grupos · A arestas · JSON Canvas 1.0".

## 5. Testes

- `lib`: `statusDe`, `buscar` (acento, AND de tokens, vazio), `layoutPolar`
  (determinístico; nós do mesmo domínio/nível não colidem em y; nível 1 mais
  perto do centro), `paraJsonCanvas` (grupos, lados, arquivo de nó, aresta
  filtrada quando um lado está oculto).
- actions (Prisma mockado): código duplicado, ligação duplicada, `deId ===
  paraId`, diagrama de outro kind recusado, exclusão em cascata (mock
  `$transaction` não precisa — cascade é do banco; o teste confere só o
  `delete` e o audit).
- grafo (jsdom): clique seleciona e chama `onSelecionar`; filtro remove nó e
  as arestas dele; `podeEscrever=false` esconde "Novo processo", "Editar",
  "Excluir" e o × das ligações, mas mantém ".canvas" (exportar é leitura).
- diálogo: "Salvar" desabilitado até código/nome/descrição; submit chama
  `onSalvar` com `tags` como array.

## 6. Produção

1. Push → Vercel aplica `20260909000000_mapa_de_processos`.
2. `2026-09-seed-processos.sql` no SQL Editor → `21 | 23`.
3. Verificar `/ferramentas/processos` autenticado: badges, grafo, painel,
   export.
