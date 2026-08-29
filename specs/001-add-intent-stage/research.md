# Research: Estágio de Intent

Nenhum `[NEEDS CLARIFICATION]` restou no Technical Context — as decisões abaixo documentam escolhas de projeto feitas durante o brainstorming, não lacunas.

## Decision: parsing de frontmatter sem `yq`

**Decision**: `check-intent-approved.sh` extrai o valor de `status:` via `grep`/`sed` simples nas primeiras ~20 linhas do arquivo, sem dependência externa.

**Rationale**: `yq` não está instalado no ambiente (`which yq` → not found). `python3` está disponível e é o que `update-agent-context.sh` (extensão `agent-context`) já usa para parsing mais complexo — mas o frontmatter aqui tem uma única chave relevante (`status`), então grep/sed evita até a dependência de python3, mantendo o script mais simples que o par existente.

**Alternatives considered**:
- **python3 + yaml module**: mesmo padrão da extensão `agent-context`. Rejeitado por ser mais pesado do que uma chave única justifica.
- **yq**: não instalado; adicionar como dependência nova só pra isso seria desproporcional.

## Decision: reusar `create-new-feature.sh` em vez de duplicar

**Decision**: `/speckit-intent` chama o script existente (`--short-name`, `--allow-existing-branch`) em vez de reimplementar numeração sequencial de pastas.

**Rationale**: o script já resolve numeração (`get_highest_from_specs`), sanitização de nome, limite de 244 bytes de branch name, e persiste `.specify/feature.json`. Reimplementar duplicaria ~150 linhas de bash já testadas em produção pelo `speckit-specify`.

**Alternatives considered**:
- **Script próprio pro intent**: rejeitado — duplicação sem ganho; o side-effect de criar um `spec.md` vazio junto é aceitável (documentado no spec.md como decisão consciente, `/speckit-specify` sobrescreve depois).

## Decision: gate via extensão (`before_specify` hook), não edição de template vendored

**Decision**: novo hook mandatory em `.specify/extensions.yml` + extensão `.specify/extensions/intent-gate/`, seguindo exatamente o padrão já em uso pela extensão `agent-context`.

**Rationale**: `speckit-specify`/SKILL.md já tem a leitura de `before_specify` embutida nas suas Pre-Execution Checks — é o único ponto de extensão que não requer tocar em arquivo com `source: templates/commands/specify.md` (FR-009). Confirmado no repo: `extensions.yml` (nível raiz) é o que a instrução do `speckit-specify` lê em runtime; o `extension.yml` dentro de `.specify/extensions/agent-context/` é metadado/documentação da extensão, espelhado manualmente na entrada raiz.

**Alternatives considered**:
- **Editar `speckit-specify/SKILL.md` diretamente**: mais simples de implementar, mas viola FR-009 e quebra em upgrade do speckit.
- **Hook via Claude Code `PreToolUse`** (mecanismo nativo do harness, não do speckit): rejeitado — hooks do harness interceptam chamadas de tool (Bash/Edit/Write), não invocação de skill; não haveria como distinguir "rodando `/speckit-specify`" de qualquer outro uso das mesmas tools.
