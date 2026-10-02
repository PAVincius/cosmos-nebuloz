# Sugestões do Vigilante

Geradas pelo modelo local. Nada aqui é aplicado sem a Morgana e o CEO.

## 2026-09-26T16:33:26.493Z · resumo c3d27ca06c2efb85

1. **Mudança**: Atualizar o papel de `rtk` para incluir suporte a compound predicates e ações (como `-not`, `-exec`) no comando `find`.  
**Evidência**: "rtk find does not support compound predicates or actions (e.g. -not, -exec). Use `find` dir |"  
**Dono**: Infra  
**Degrav**: erro de ferramenta (repetido) → indica falta de skill no papel de `rtk`  

2. **Mudança**: Adicionar validação de presença de string antes de operações de substituição em arquivos.  
**Evidência**: "rg: regex parse error: | 1× <tool_use_error>String to replace not found in file." e "Morgana: <tool_use_error>File has not been read yet."  
**Dono**: Dev Meridian, CRO, Morgana  
**Degrav**: skill de verificação prévia de conteúdo antes de operações de edição  

3. **Mudança**: Atualizar o prompt do papel de CPO para evitar uso de `execSync` em contextos que não garantem segurança ou autenticação.  
**Evidência**: "import { execSync } from 'node:child_process';" com erro de memória de empresa  
**Dono**: CPO  
**Degrav**: erro de memória do agente → indica instrução errada no papel (falta de regra no gate para uso de execSync)  

4. **Mudão**: Implementar validação de sintaxe de comandos shell antes de execução, para evitar erros de `syntax error near unexpected token '('`.  
**Evidência**: "PO: 1 erro(s) — 1× Exit code 2 · sh: -c: line 0: syntax error near unexpected token '('"  
**Dono**: PO  
**Degrav**: erro de ferramenta → indica falta de skill em teste/lint para comandos shell  

5. **Mudança**: Atribuir regra no gate para que operações de leitura de arquivo ocorram antes de escrita, especialmente em agentes que usam `write` após `read`.  
**Evidência**: "Morgana: <tool_use_error>File has not been read yet. Read it first before writing to it."  
**Dono**: Morgana  
**Degrav**: erro de ferramenta → indica falta de regra no gate para sequência de leitura antes de escrita  

> Nota: O erro de "descasamento de ICP" não foi tratado como sugestão, pois não está ligado a erro de ferramenta, mas a um problema de negócio.

## 2026-09-26T20:38:58.074Z · resumo 4b9303169c4f7d04

1. **Mudança**: Atualizar o *prompt do papel de QA* para incluir validação prévia de entrada JSON antes de chamar ferramentas de leitura.  
**Evidência**: "2× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON."  
**Dono**: QA  
**Degrau**: skill do papel — erro de ferramenta indica falta de validação de entrada antes de uso de ferramenta de leitura.  

2. **Mudança**: Reforçar a *regra no gate* para bloquear uso de `find` com predicados compostos (como `-not`, `-exec`) em infra.  
**Evidência**: "2× Exit code 1 · rtk: rtk find does not support compound predicates or actions (e.g. -not, -exec). Use `find` dir"  
**Dono**: Infra  
**Degrau**: regra no gate — erro repetido indica falta de validação de sintaxe antes do uso de comandos avançados.  

3. **Mudança**: Ajustar o *prompt do papel de Dev Meridian* para evitar uso de `rg` com regex inválida e incluir validação de sintaxe.  
**Evidência**: "2× Exit code 2 · rg: regex parse error: | 2× Exit code 2 · sh: -c: line 0: syntax error near unexpected token `('"  
**Dono**: Dev Meridian  
**Degrau**: skill do papel — erros de sintaxe indicam falta de validação de expressões antes de execução.  

4. **Mudança**: Atualizar o *prompt do papel de PO* para incluir verificação de consentimento antes de operações de edição de arquivos.  
**Evidência**: "1× The user doesn't want to proceed with this tool use. The tool use was rejected"  
**Dono**: PO  
**Degrau**: skill do papel — erro de ferramenta indica que o agente não está validando a intenção do usuário antes de agir.  

5. **Mudança**: Inserir *teste de lint* para validar que arquivos de configuração (como `.env.local`) não estejam em pastas de aplicação sem validação de contexto.  
**Evidência**: "1× Exit code 1 · .gitignore:147:.env.local apps/app/.env.local"  
**Dono**: Dev Plataforma  
**Degrau**: teste/lint — erro indica que o sistema não valida o contexto de arquivos sensíveis antes de operações.  

> ⚠️ Observação: O erro de "segredo mostrado" sem forçar cópia ou reemissão (14x) é repetido, mas não está ligado a erro de ferramenta — é um caso de *falta de regra no gate* de proteção de dados. Sugeriria uma *regra no gate* para bloquear exibição de segredos sem autenticação, mas não está no formato de erro de ferramenta. Portanto, não é tratado aqui como erro de ferramenta.

## 2026-09-26T21:09:28.122Z · resumo ae07450c26fcb5e6

1. **Mudança**: Corrigir o prompt do papel de *QA* para evitar uso de scripts anônimos com `sh -c` em ambientes que não validam sintaxe.  
**Evidência**: 28 erros de QA — 4× `Exit code 2 · sh: -c: line 0: syntax error near unexpected token '('` e 2× `Exit code 1 · <anonymous_script>:1`  
**Dono**: QA  
**Degrau**: *Skill do papel* — falta de habilidade em validação de sintaxe antes de execução. O erro indica que o agente está usando scripts não testados, comprovando falha no *skill de validação de comandos*.  

2. **Mudança**: Atualizar a regra no *gate de execução* para bloquear uso de `find` com predicados compostos (como `-not`, `-exec`) antes de validação.  
**Evidência**: 22 erros em *Infra* — 2× `rtk find does not support compound predicates or actions`  
**Dono**: Infra  
**Degrau**: *Regra no gate* — a equipe está usando ferramentas sem validação prévia de sintaxe complexa. A regra deve exigir análise de expressão antes da execução.  

3. **Mudança**: Ajustar o *prompt do papel de Dev Meridian* para evitar uso de `rg` com regex inválidos.  
**Evidência**: 19 erros — 2× `regex parse error`, 2× `syntax error near unexpected token '('`  
**Dono**: Dev Meridian  
**Degrau**: *Skill do papel* — falta de habilidade em validação de padrões regulares; erro recorrente indica necessidade de treinamento em análise de expressões.  

4. **Mudança**: Corrigir o *prompt do papel de Security Reviewer* para evitar uso de comandos `git diff` com argumentos ambíguos.  
**Evidência**: 6 erros — 1× `fatal: ambiguous argument` e 1× `no matches found: --include=*.ts`  
**Dono**: Security Reviewer  
**Degrau**: *Skill do papel* — o agente não tem domínio de tratamento de argumentos de comando; necessita de validação de entrada antes de execução.  

5. **Mudança**: Atualizar a *memória da área* de *Vigia* para incluir padrão de "segredo mostrado sem reemissão" como indicador de risco.  
**Evidência**: 2× segredo mostrado sem forçar cópia nem permitir reemissão (Morgana)  
**Dono**: Vigia  
**Degrau**: *Memória da área* — o padrão de exposição de segredos sem controle é recorrente e deve ser documentado como alerta crítico.  

> ⚠️ Observação: O erro de *CRO* com "string to replace not found" é isolado, mas pode indicar falta de *prompt claro* no papel — sugerido como *revisão de prompt* (não listado por prioridade). O erro de *CPO* com `grep: No such file` é de falta de *check de arquivo existente* — pode ser tratado como *regra no gate* para validação prévia de arquivos.  

**Conclusão**: As 5 sugestões acima priorizam falhas críticas em *skill*, *regras de execução* e *memória de área*, com base em padrões repetidos e erros de sintaxe.

## 2026-09-26T21:39:59.853Z · resumo ef3fe305fda37176

1. **Mudança**: Atualizar o prompt do papel *Dev Plataforma* para incluir verificação explícita de variáveis de ambiente antes de executar comandos com `auth setup`.  
**Evidência**: "Skipping auth setup (AUTH_TEST not set)" (Dev Plataforma)  
**Dono**: Dev Plataforma  
**Degrau**: skill do papel — erro de ferramenta decorre de falta de verificação prévia antes de usar ferramentas de autenticação.

2. **Mudança**: Corrigir o uso de `rtk find` com predados compostos (ex: `-not`, `-exec`) e substituir por `find dir` com lógica de filtro separada.  
**Evidência**: "rtk find does not support compound predicates or actions" (Infra)  
**Dono**: Infra  
**Degrau**: regra no gate — erro de ferramenta repetido indica falha em regras de validação de comandos.

3. **Mudança**: Adicionar validação prévia de leitura de arquivo antes de escrever nele, no papel *QA*.  
**Evidência**: "File has not been read yet. Read it first before writing to it." (QA)  
**Dono**: QA  
**Degrau**: skill do papel — erro de ferramenta é sinal de falta de habilidade em fluxo de operação de arquivos.

4. **Mudança**: Ajustar o prompt do papel *CPO* para evitar uso de `grep` em arquivos de documento sem verificação de existência.  
**Evidência**: "grep: docs/produto/prontidao-lancamento.md docs/produto/regra-maturidade-e-carga.md: No such file"  
**Dono**: CPO  
**Degrau**: memória da área — erro indica que a área não tem acesso ou conhecimento sobre estrutura de documentos.

5. **Mudança**: Incluir validação de presença de arquivo `.env` antes de usar `ls` em pastas de pacotes.  
**Evidência**: "ls: packages/database/.env.dev: No such file or directory" (Morgana)  
**Dono**: Morgana  
**Degrau**: memória do agente — erro de ferramenta indica falta de conhecimento local sobre estrutura de projeto.  

> Nota: O erro de "descasamento de ICP" (CRO) não é um erro de ferramenta, mas de alinhamento de requisitos — não é relevante para evolução técnica de ferramentas.

## 2026-09-26T22:10:24.802Z · resumo ab5e97542a8dcd9f

1. **Mudança**: Atualizar o prompt do papel *Morgana* para incluir validação prévia de arquivos antes de operações de leitura/escrita.  
**Evidência**: "Morgana: 2 erro(s) — 1× Exit code 2 · ls: packages/database/.env.dev: No such file or directory"  
**Dono**: Morgana  
**Degrau**: skill do papel — erro de ferramenta devido a falta de verificação prévia de existência de arquivos.  

2. **Mudança**: Corrigir a regra no gate para *Dev Plataforma* que ignora `AUTH_TEST not set` — atualizar para exigir configuração de autenticação explícita.  
**Evidência**: "Dev Plataforma: 28 erro(s) — 4× Exit code 1 | 4× Exit code 1 · ⏭ Skipping auth setup (AUTH_TEST not set)"  
**Dono**: Dev Plataforma  
**Degrau**: regra no gate — erro de ferramenta por ausência de condição de autenticação.  

3. **Mudança**: Atualizar o skill do papel *QA* para incluir validação de que o arquivo foi lido antes de escrita.  
**Evidência**: "QA: 30 erro(s) — 2× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>"  
**Dono**: QA  
**Degrau**: skill do papel — erro de ferramenta por falta de sequência lógica entre leitura e escrita.  

4. **Mudança**: Ajustar o prompt do papel *Dev Meridian* para evitar uso de `rg` com regex que causa erro de parse — substituir por `grep` com padrão simples.  
**Evidência**: "Dev Meridian: 21 erro(s) — 2× Exit code 2 · rg: regex parse error: | 2× Exit code 2 · sh: -c: line 0: syntax error near unexpected token `('"  
**Dono**: Dev Meridian  
**Degrau**: skill do papel — erro de ferramenta por uso inadequado de ferramentas de busca.  

5. **Mudança**: Atualizar a memória da área para incluir padrão de tratamento de "segredo mostrado" — evitar exibição sem reemissão forçada.  
**Evidência**: "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono**: Vigia  
**Degrau**: memória da área — erro de segurança que se repete, exigindo protocolo claro de controle de acesso.  

> ⚠️ Observação: O erro de "segredo mostrado" sem reemissão é repetido e crítico — indica falha de protocolo, não apenas erro técnico. A sugestão de memória da área é a mais urgente para prevenir riscos.

## 2026-09-27T00:40:39.283Z · resumo 65dd266f40a9537d

1. **Mudança**: Atualizar o prompt do papel *Morgana* para incluir validação prévia de arquivos antes de operações de leitura/escrita.  
**Evidência**: "Morgana: 2 erro(s) — 1× Exit code 2 · ls: packages/database/.env.dev: No such file or directory"  
**Dono**: Morgana  
**Degrau**: skill do papel — erro de ferramenta devido a falta de verificação prévia de contexto de arquivo.  

2. **Mudança**: Reforçar a regra no gate para bloquear uso de `sh -c` com parênteses (`(`) sem validação de sintaxe.  
**Evidência**: "Infra: 6× Exit code 1 | 2× Exit code 2 · sh: -c: line 0: syntax error near unexpected token `('"  
**Dono**: Infra  
**Degrau**: regra no gate — repetição de erro indica falha em validação de comandos antes da execução.  

3. **Mudança**: Atualizar o skill do papel *QA* para incluir tratamento de "file not read yet" antes de operações de escrita.  
**Evidência**: "QA: 2× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>"  
**Dono**: QA  
**Degrau**: skill do papel — erro de ferramenta típico de falta de sequência lógica em fluxo de trabalho.  

4. **Mudança**: Ajustar o prompt do papel *Dev Meridian* para evitar uso de `rg` com regex inválida.  
**Evidência**: "Dev Meridian: 2× Exit code 2 · rg: regex parse error:"  
**Dono**: Dev Meridian  
**Degrau**: skill do papel — erro de interpretação de padrão; necessita de validação de expressão antes da execução.  

5. **Mudança**: Inserir verificação de contexto de memória de empresa no papel *CPO* para evitar conflitos com dados de negócio.  
**Evidência**: "CPO: 1× Exit code 1 · # memória de empresa (do usuário, não de produto)"  
**Dono**: CPO  
**Degrau**: memória da área — erro de conflito entre memória de empresa e produtos; necessita de clareza no escopo.  

> ⚠️ Observação: O erro "Descasamento de ICP" (CRO) não é repetido nem vinculado a agente com múltiplas ocorrências — não justifica evolução. O erro de "segredo mostrado" (2x) é raro e não indica falha de skill ou regra — não é priorizado.

## 2026-09-27T02:41:26.922Z · resumo 8552cd057105cf46

1. **Mudança**: Atualizar o prompt do papel *Morgana* para incluir validação explícita de arquivos antes de operações de leitura/escrita.  
**Evidência**: "Morgana: 2 erro(s) — 1× Exit code 2 · ls: packages/database/.env.dev: No such file or directory"  
**Dono**: Morgana  
**Degrau**: skill do papel — erro de ferramenta devido a falta de verificação prévia de existência de arquivos.  

2. **Mudança**: Reforçar a regra no gate para *Dev Plataforma* exigir definição de `AUTH_TEST` antes de usar ferramentas de autenticação.  
**Evidência**: "Dev Plataforma: 28 erro(s) — 4× Exit code 1 | 4× Exit code 1 · ⏭ Skipping auth setup (AUTH_TEST not set)"  
**Dono**: Dev Plataforma  
**Degrau**: regra no gate — erro repetido por ausência de condição de teste prévia.  

3. **Mudança**: Atualizar o skill do papel *QA* para incluir validação de que o arquivo foi lido antes de qualquer escrita.  
**Evidência**: "QA: 30 erro(s) — 2× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>"  
**Dono**: QA  
**Degrau**: skill do papel — erro de ferramenta por falta de sequência lógica entre leitura e escrita.  

4. **Mudança**: Corrigir o uso de `rtk find` em *Infra* com substituição por `find` com parâmetros simples e sem operadores compostos.  
**Evidência**: "Infra: 33 erro(s) — 6× Exit code 1 | 2× Exit code 2 · sh: -c: line 0: syntax error near unexpected token `(' | 2× Exit code 1 · rtk: rtk find does not support compound predicates or actions"  
**Dono**: Infra  
**Degrau**: skill do papel — erro de ferramenta por uso incorreto de ferramentas de busca.  

5. **Mudança**: Ajustar o prompt do papel *CPO* para evitar uso de `grep` em arquivos de documento sem validação de caminho.  
**Evidência**: "CPO: 3 erro(s) — 1× Exit code 128 · grep: docs/produto/prontidao-lancamento.md docs/produto/regra-maturidade-e-carga.md: No such file"  
**Dono**: CPO  
**Degrau**: skill do papel — erro de ferramenta por tentativa de operação em arquivos que não existem.  

> ⚠️ Observação: O erro de "segredo mostrado" sem forçar cópia ou reemissão (2×) é repetido, mas não está ligado a erro de ferramenta — é um erro de segurança. Se for crítico, deve ser tratado fora do escopo de *skill/prompt* e em regra de acesso. Não é sugerido aqui por não ter relação direta com erro de ferramenta.

## 2026-09-27T03:12:02.587Z · resumo 49457a76beaca185

1. **Mudança**: Atualizar o prompt do papel *Dev Plataforma* para incluir verificação explícita de variáveis de ambiente antes de executar comandos de autenticação.  
**Evidência**: "Skipping auth setup (AUTH_TEST not set)" (Dev Plataforma)  
**Dono**: Dev Plataforma  
**Degrau**: skill do papel — erro de ferramenta decorre de falta de verificação prévia antes de usar autenticação.  

2. **Mudança**: Corrigir a regra no gate para *rtk find* — substituir uso de `rtk find` por `find` com comandos simples, evitando predados compostos.  
**Evidência**: "rtk: rtk find does not support compound predicates or actions" (Infra, QA, PO, CPO)  
**Dono**: QA, Infra, PO, CPO  
**Degrau**: regra no gate — erro recorrente indica falta de regra de uso de ferramentas; deve ser documentada e bloqueada para uso de `rtk find`.  

3. **Mudança**: Atualizar o skill do papel *Vigia* para incluir validação de arquivos antes de operações de escrita.  
**Evidência**: "File has not been read yet. Read it first before writing to it." (QA)  
**Dono**: QA  
**Degrau**: skill — erro de ferramenta (tool use error) indica falta de habilidade em sequência de operações de leitura/escrita.  

4. **Mudança**: Ajustar o prompt do papel *Morgana* para incluir verificação de arquivos de ambiente antes de listas (`ls`).  
**Evidência**: "ls: packages/database/.env.dev: No such file or directory"  
**Dono**: Morgana  
**Degrau**: memória do agente — erro indica falta de conhecimento local sobre estrutura de pastas; deve ser reforçado com memória contextual.  

5. **Mudança**: Inserir teste de lint no pipeline de *Dev Meridian* para validar regex antes de execução.  
**Evidência**: "rg: regex parse error" (Dev Meridian)  
**Dono**: Dev Meridian  
**Degrau**: teste/lint — erro de sintaxe em regex indica ausência de validação prévia; necessário um teste de validação de expressões.  

> ⚠️ Observação: O erro "segredo mostrado" sem forçar cópia ou reemissão (2x) é repetido — mas não há indício de falha técnica, apenas de segurança. Não é um erro de ferramenta, mas de protocolo. Se for crítico, deve ser tratado como *regra no gate* ou *revisão de acesso*, mas não está no escopo de erro de ferramenta.

## 2026-09-27T03:42:29.803Z · resumo 59e1782a74ace63f

1. **Mudança**: Atualizar o prompt do papel *Dev Plataforma* para incluir verificação explícita de `AUTH_TEST` antes de executar autenticação.  
**Evidência**: "Skipping auth setup (AUTH_TEST not set)" (Dev Plataforma)  
**Dono**: Dev Plataforma  
**Degrau**: Skill do papel — erro de ferramenta repetido indica falta de habilidade de verificação prévia antes de operações de autenticação.

2. **Mudança**: Corrigir o uso de `rtk find` por `find` com comandos simples; substituir predados compostos por operações lineares.  
**Evidência**: "rtk: rtk find does not support compound predicates or actions" (Infra, QA, PO)  
**Dono**: Infra, QA, PO  
**Degrau**: Regra no gate — erro recorrente indica falha em regras de uso de ferramentas; deve haver um gate de validação de comando antes de execução.

3. **Mudança**: Adicionar verificação de URL e banco de dados antes de executar passos de produção no ambiente local.  
**Evidência**: "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono**: Morgana  
**Degrau**: Memória da área — a repetição indica que a equipe não tem memória contextual de ambiente de produção; necessita de checklist de validação.

4. **Mudança**: Atualizar o prompt do papel *Vigia* para incluir ação de bloqueio automático de "segredo mostrado" sem reemissão.  
**Evidência**: "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono**: Vigia  
**Degrau**: Skill do papel — erro de ferramenta indica falta de habilidade de controle de acesso e proteção de dados.

5. **Mudança**: Inserir validação prévia de arquivo antes de operações de escrita (como edição ou replace).  
**Evidência**: "File has not been read yet. Read it first before writing to it." (QA)  
**Dono**: QA  
**Degrau**: Teste/lint — erro de ferramenta indica ausência de validação de pré-condição antes de operações de escrita em arquivos.

## 2026-09-27T12:43:18.894Z · resumo 2cff05b91e757228

1. **Mudança**: Atualizar o prompt do papel *Dev Plataforma* para incluir verificação explícita de `AUTH_TEST` antes de executar autenticação.  
**Evidência**: "Skipping auth setup (AUTH_TEST not set)" (Dev Plataforma)  
**Dono**: Dev Plataforma  
**Degrau**: Skill do papel — erro de ferramenta repetido indica falta de habilidade de verificação prévia antes de operações de autenticação.

2. **Mudança**: Corrigir o uso de `rtk find` por `find` com comandos simples; substituir predados compostos por operações lineares.  
**Evidência**: "rtk: rtk find does not support compound predicates or actions" (Infra, QA, PO)  
**Dono**: Infra, QA, PO  
**Degrau**: Regra no gate — erro recorrente indica falha em regras de uso de ferramentas; deve haver um gate de validação de comando antes de execução.

3. **Mudança**: Adicionar verificação de URL e banco de dados antes de executar passos de produção no ambiente local.  
**Evidência**: "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono**: Morgana  
**Degrau**: Memória da área — a equipe não tem memória de contexto de ambiente de produção; necessita de reforço de checklist de validação.

4. **Mudança**: Atualizar o prompt do papel *Vigia* para incluir ação de bloqueio automático de "segredo mostrado" sem reemissão.  
**Evidência**: "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono**: Vigia  
**Degrau**: Regra no gate — a ausência de regras de proteção de dados indica falha no gate de segurança; deve haver um bloqueio automático.

5. **Mudança**: Inserir validação prévia de arquivo antes de operações de escrita (como edição ou replace).  
**Evidência**: "File has not been read yet. Read it first before writing to it." (QA)  
**Dono**: QA  
**Degrau**: Skill do papel — erro de ferramenta indica falta de habilidade de fluxo sequencial (ler → validar → escrever).  

> ⚠️ Observação: O erro "String to replace not found" (CRO) é de ferramenta, mas não tem repetição. Não é prioritário. O erro de "memória de empresa" (CPO) é de contexto, mas não está ligado a operação técnica — não é ação corrigível por skill ou regra.

## 2026-09-27T13:43:36.612Z · resumo c922f394087b2d88

1. **Mudança**: Atualizar o prompt do papel *Dev Plataforma* para incluir verificação explícita de `AUTH_TEST` antes de executar autenticação.  
**Evidência**: "Skipping auth setup (AUTH_TEST not set)" (Dev Plataforma)  
**Dono**: Dev Plataforma  
**Degrau**: Skill do papel — erro de ferramenta repetido indica falta de habilidade de verificação prévia antes de operações de autenticação.

2. **Mudança**: Corrigir o uso de `rtk find` por `find` com comandos simples; substituir predados compostos por operações lineares.  
**Evidência**: "rtk: rtk find does not support compound predicates or actions" (Infra, QA, PO)  
**Dono**: Infra, QA, PO  
**Degrau**: Regra no gate — erro recorrente indica falha em regras de uso de ferramentas; deve haver um gate de validação de comando antes de execução.

3. **Mudança**: Adicionar verificação de URL e banco de dados antes de executar passos de produção no ambiente local.  
**Evidência**: "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono**: Morgana  
**Degrau**: Memória da área — a repetição indica que a equipe não tem memória contextual de ambiente de produção; necessita de checklist de verificação.

4. **Mudança**: Atualizar o prompt do papel *Vigia* para incluir ação de bloqueio automático de "segredo mostrado" sem reemissão.  
**Evidência**: "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono**: Vigia  
**Degrau**: Skill do papel — erro de ferramenta indica falta de habilidade de controle de acesso e proteção de dados.

5. **Mudança**: Inserir validação prévia de arquivo antes de operações de escrita (ex: `read` antes de `write`).  
**Evidência**: "File has not been read yet. Read it first before writing to it." (QA)  
**Dono**: QA  
**Degrau**: Teste/lint — erro de ferramenta indica ausência de validação de pré-condição no fluxo de trabalho.

## 2026-09-27T14:14:15.064Z · resumo 2ea320f53b786acf

1. **Mudança**: Atualizar o prompt do papel *Dev Plataforma* para incluir verificação explícita de `AUTH_TEST` antes de executar autenticação.  
**Evidência**: "Skipping auth setup (AUTH_TEST not set)" (Dev Plataforma)  
**Dono**: Dev Plataforma  
**Degrau**: Skill do papel — erro de ferramenta repetido indica falta de habilidade de verificação prévia antes de operações de autenticação.

2. **Mudança**: Corrigir o uso de `rtk find` por `find` com comandos simples; substituir predados compostos por operações lineares.  
**Evidência**: "rtk: rtk find does not support compound predicates or actions" (Infra, QA, PO)  
**Dono**: Infra, QA, PO  
**Degrau**: Regra no gate — erro recorrente indica falha em regras de uso de ferramentas; deve haver um gate de validação de comando antes do uso.

3. **Mudança**: Adicionar verificação prévia de arquivo antes de operações de escrita (ex: `read` antes de `write`).  
**Evidência**: "File has not been read yet. Read it first before writing to it." (QA)  
**Dono**: QA  
**Degrau**: Skill do papel — erro de ferramenta indica falta de habilidade de fluxo sequencial em operações de arquivo.

4. **Mudança**: Inserir validação de URL e banco de dados antes de execução de passo de produção.  
**Evidência**: "passo de produção executado no ambiente local sem conferir URL nem banco" (Morgana)  
**Dono**: Morgana  
**Degrau**: Memória da área — repetição indica que a equipe não tem memória contextual de ambiente de produção.

5. **Mudança**: Atualizar o prompt do papel *Morgana* para incluir verificação de arquivos `.env` antes de operações de acesso.  
**Evidência**: "ls: packages/database/.env.dev: No such file or directory" (Morgana)  
**Dono**: Morgana  
**Degrau**: Memória do agente — erro indica falta de conhecimento local sobre estrutura de arquivos críticos.

## 2026-09-27T14:44:57.574Z · resumo 8d5a980541f8cdc5

1. **Mudança**: Atualizar o prompt do papel *Morgana* para incluir verificação explícita da URL e do banco antes de executar passos de produção.  
**Evidência**: "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono**: Morgana  
**Degrau**: skill do papel — erro recorrente indica falta de procedimento de validação antes de ação.  

2. **Mudança**: Corrigir a regra no gate de *rtk find* para evitar uso de compound predicates (como -not, -exec).  
**Evidência**: "29× - (Morgana, QA)" e "rtk: rtk find does not support compound predicates or actions" (repetido em QA, Infra, PO)  
**Dono**: QA, Infra, PO  
**Degrau**: regra no gate — erro de ferramenta repetido indica falha de instrução no papel; deve haver um gate de validação de comando.  

3. **Mudança**: Atualizar o skill do papel *Dev Plataforma* para incluir tratamento de variáveis de ambiente (como AUTH_TEST) antes de execução.  
**Evidência**: "4× Exit code 1 · Skipping auth setup (AUTH_TEST not set)"  
**Dono**: Dev Plataforma  
**Degrau**: skill do papel — erro de erro de ferramenta indica falta de verificação prévia de condições de execução.  

4. **Mudança**: Ajustar o prompt do papel *Vigia* para incluir ação de registro de eventos de "segredo mostrado" com regras de reemissão.  
**Evidência**: "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono**: Vigia  
**Degrau**: memória da área — o evento é crítico para segurança; a ausência de regras de reemissão é um vazamento potencial.  

5. **Mudança**: Inserir teste de lint no pipeline de *PO* para validar que o conteúdo a ser modificado realmente existe antes de operações de substituição.  
**Evidência**: "<tool_use_error>No changes to make: old_string and new_string are exactly the same.</tool_use_error>" e "String to replace not found in file"  
**Dono**: PO  
**Degrau**: teste/lint — erro de ferramenta indica falta de validação prévia de conteúdo, com risco de operações vazias.  

> ⚠️ Observação: O erro "segredo mostrado" sem reemissão (2x) é crítico — não é apenas um erro de ferramenta, mas de **segurança de informação**. A sugestão 4 é a mais urgente, mas está em "memória da área", não em skill. Se o papel de Vigia não tem responsabilidade de monitorar segredos, a falha é de **definição de papel** — mas como não há informação sobre papel de Vigia, a sugestão é baseada em contexto. Se o papel de Vigia não tem domínio de segurança, a correção deve vir do **papel de CPO ou PO**, mas não há dados. Portanto, a sugestão permanece.

## 2026-09-27T16:38:29.345Z · resumo 0a15e8fcad0b89e5

1. **Mudança:** Atualizar o *prompt do papel* do agente **Morgana** para incluir verificação explícita de URL e banco de dados antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** skill do papel — erro recorrente indica falta de procedimento de validação antes de operar em ambiente de produção.

2. **Mudança:** Reforçar a *regra no gate* para bloquear execução de scripts que usam `sh -c` com sintaxe não validada (ex: `('`) antes de passar por análise de sintaxe.  
**Evidência:** 30× erro com "sh: -c: line 0: syntax error near unexpected token `('" (Morgana, QA, Dev Plataforma)  
**Dono:** QA, Dev Plataforma  
**Degrau:** regra no gate — erro de sintaxe em scripts indica falha de validação prévia antes da execução.

3. **Mudança:** Ajustar o *prompt do papel* do agente **Dev Plataforma** para incluir tratamento de autenticação condicional (com `AUTH_TEST` definido) e evitar uso de `exit code 1` por falta de autenticação.  
**Evidência:** "4× Exit code 1 · ⏭ Skipping auth setup (AUTH_TEST not set)"  
**Dono:** Dev Plataforma  
**Degrau:** skill do papel — erro indica que o agente não tem habilidade de lidar com cenários de teste sem autenticação.

4. **Mudança:** Atualizar o *prompt do papel* do agente **PO** para evitar uso de `rtk find` com predados complexos e substituir por `find` com comandos simples.  
**Evidência:** "3× Exit code 1 · rtk: rtk find does not support compound predicates or actions"  
**Dono:** PO  
**Degrau:** skill do papel — erro de ferramenta indica falta de conhecimento sobre limitações de ferramentas.

5. **Mudança:** Inserir *teste de lint* obrigatório antes de qualquer operação que envolva modificação de arquivos compartilhados (ex: `.env.dev`, arquivos de teste).  
**Evidência:** "1× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>" (QA), "1× Exit code 7 · FAILED: curl 000" (Morgana)  
**Dono:** QA, Morgana  
**Degrau:** teste/lint — erros de escrita antes de leitura indicam ausência de pipeline de validação prévia.  

> ⚠️ Observação: O erro "Permission for this action was denied by the Claude Code auto mode classifier" (Infra, Dev Meridian) é repetido e não está diretamente ligado a um papel específico — mas é sinal de que a **regra no gate** de acesso a recursos compartilhados precisa ser revisada. Sugerimos *regra no gate* como degrau, mas já está coberto acima.

## 2026-09-27T17:34:32.313Z · resumo d97349a462268297

1. **Mudança:** Atualizar o *prompt do papel* de Morgana para incluir verificação explícita da URL e do banco de dados antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** skill do papel — a repetição indica falta de procedimento de validação, não apenas erro técnico.  

2. **Mudança:** Reforçar a *regra no gate* para bloquear execuções de produção sem URL e banco confirmados, com exceção de testes autorizados.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Vigia  
**Degrau:** regra no gate — a repetição sugere que a ausência de verificação é um padrão, exigindo controle ativo.  

3. **Mudança:** Corrigir o *prompt do papel* do Dev Plataforma para incluir instrução explícita sobre a necessidade de `AUTH_TEST` estar definido antes de iniciar autenticação.  
**Evidência:** "4× Exit code 1 | Skipping auth setup (AUTH_TEST not set)"  
**Dono:** Dev Plataforma  
**Degrau:** skill do papel — erro repetido indica falha de instrução, não de habilidade técnica.  

4. **Mudança:** Atualizar o *prompt do papel* do QA para evitar uso de `read` antes de `read` ser executado, evitando erro de "File has not been read yet".  
**Evidência:** "2× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>"  
**Dono:** QA  
**Degrau:** skill do papel — erro de sequência de operações indica falta de lógica de fluxo.  

5. **Mudança:** Adicionar verificação de *memória da área* para a equipe de Dev Meridian, especialmente em operações que envolvem backup e estado local.  
**Evidência:** "2× Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Irreversible Local Des]"  
**Dono:** Dev Meridian  
**Degrau:** memória da área — erro de permissão indica falta de contexto de estado local, exigindo memória compartilhada.  

> ⚠️ Observação: O erro de "reprovado" em 18 casos para Morgana (com 26 aprovados) e 10 reprovados para QA sugere que a repetição de erros não está em falta de habilidade, mas em *falhas de instrução no papel*. Ainda assim, a sugestão de *regra no gate* é crítica para evitar repetições.

## 2026-09-27T18:05:51.965Z · resumo 8303b7bda95be9e0

1. **Mudança:** Atualizar o *prompt do papel* de Morgana para incluir verificação explícita da URL e do banco de dados antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** skill do papel — a repetição indica falha de *skill* em operação segura, não apenas erro de instrução.  

2. **Mudança:** Reforçar a *regra no gate* para bloquear execução de passos de produção sem validação de ambiente (URL + banco) — especialmente para agentes com histórico de erro.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Vigia  
**Degrau:** regra no gate — o erro é repetido e crítico, exigindo controle de acesso baseado em validação.  

3. **Mudança:** Corrigir o *prompt do papel* de QA para evitar uso de `read` antes de `write`, com instrução explícita de "leia antes de escrever".  
**Evidência:** "2× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>"  
**Dono:** QA  
**Degrau:** skill do papel — erro de ferramenta indica falta de *skill* em sequência de operações.  

4. **Mudança:** Atualizar o *prompt do papel* de Dev Plataforma para incluir tratamento de `AUTH_TEST not set` como condição de skip, evitando falhas de autenticação.  
**Evidência:** "4× Exit code 1 · Skipping auth setup (AUTH_TEST not set)"  
**Dono:** Dev Plataforma  
**Degrau:** skill do papel — erro de ferramenta é resultado de instrução errada no papel (não há verificação de condição).  

5. **Mudança:** Adicionar *testes de lint* para validação de estrutura de comando em scripts de infra e PO, especialmente com uso de `find` e `rtk`.  
**Evidência:** "PO: 8 erro(s) — 3× Exit code 1 | 1× Exit code 2 · sh: -c: line 0: syntax error near unexpected token `('" | "PO: 8 erro(s) — 3× Exit code 1 | 1× Exit code 2 · rtk: rtk find does not support compound predicates..."  
**Dono:** PO  
**Degrau:** teste/lint — erros de sintaxe e uso incorreto de ferramentas indicam falta de validação prévia.  

> ⚠️ Observação: O erro de "segredo mostrado" (2×) sem forçar cópia ou reemissão é crítico, mas não está ligado a um erro de ferramenta direto — é mais um problema de *regra de acesso*. Sugeriria uma *regra no gate* ou *memória da área* para bloquear exibição de dados sensíveis, mas não há evidência direta de falha de ferramenta. Portanto, não incluí.

## 2026-09-27T18:36:34.756Z · resumo c88aa5986e26916f

1. **Mudança:** Atualizar o *prompt do papel* de Morgana para incluir verificação explícita da URL e do banco de dados antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** Skill do papel — a repetição indica falha de *skill* em operação segura. O erro é de *instrução errada no papel* (não há verificação antes de agir).  

2. **Mudança:** Reforçar a *regra no gate* para bloquear execução de operações que não validem a integridade do arquivo antes de escrevê-lo.  
**Evidência:** "2× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error> (QA)"  
**Dono:** QA  
**Degrau:** Regra no gate — erro de *falta de skill* em sequência de operações. O agente tenta escrever antes de ler, indicando ausência de validação.  

3. **Mudança:** Ajustar o *prompt do papel* de Dev Plataforma para incluir tratamento de erro de entrada JSON (input validation) como erro crítico, com requisição de reparse.  
**Evidência:** "5× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON"  
**Dono:** Dev Plataforma  
**Degrau:** Skill do papel — erro de *falta de skill* em tratamento de dados. O agente não valida entrada antes de processar.  

4. **Mudança:** Inserir *teste de lint* para validar que operações de backup e execução local não ocorram sem verificação de estado inicial.  
**Evidência:** "2× Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Irreversible Local Des]" (Dev Meridian)  
**Dono:** Dev Meridian  
**Degrau:** Teste/lint — erro de *falta de skill* em operações reversíveis. O agente tenta operações irreversíveis sem validação.  

5. **Mudança:** Atualizar a *memória da área* do agente Vigia para registrar eventos de "segredo mostrado" com ação de bloqueio automático.  
**Evidência:** "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono:** Vigia  
**Degrau:** Memória da área — o agente não tem mecanismo de resposta a exposição de segredos. O erro é de *falta de memória contextual* para prevenir reexposição.  

> ⚠️ Observação: O erro de "Exit code 1" em múltiplos agentes (Morgana, QA, Infra, PO) é repetido — isso indica *falta de skill* ou *instrução errada no papel*, especialmente em operações que exigem validação prévia. A sugestão de *regra no gate* (ponto 2) é crítica para evitar falhas em operações críticas.

## 2026-09-27T20:25:23.609Z · resumo b4e9410fbf5bff05

1. **Mudar: Prompt do papel de Morgana para incluir validação de URL e banco antes de executar passos de produção**  
   *Evidência:* "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
   *Dono:* Morgana  
   *Degrau:* **Skill do papel** – o agente está falhando em validar entradas críticas antes de operar. A falha é repetida e indica falta de skill em verificação de ambiente.  

2. **Mudar: Revisão de erro de ferramenta "InputValidationError: Read was called with input that could not be parsed as JSON" em QA e Infra**  
   *Evidência:* "2× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON. · You sent" (QA e Infra)  
   *Dono:* QA, Infra  
   *Degrau:* **Regra no gate** – a ferramenta está sendo usada com entrada inválida; deve haver uma regra de validação de entrada antes do uso de `read` ou `write`.  

3. **Mudar: Atualizar o prompt de Vigia para incluir ação de registro de "segredo mostrado" com restringimento de reemissão**  
   *Evidência:* "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
   *Dono:* Vigia  
   *Degrau:* **Memória da área** – o padrão de exposição de segredos deve ser documentado e restringido; o papel de Vigia deve ter regras de monitoramento e bloqueio de reemissão.  

4. **Mudar: Adicionar validação de ambiente local antes de execução em passos de produção (Morgana)**  
   *Evidência:* "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
   *Dono:* Morgana  
   *Degrau:* **Teste/lint** – o erro é repetido; deve haver um teste de lint que valide a URL e o banco antes de prosseguir.  

5. **Mudar: Corrigir erro de comando com `sh: -c: line 0: syntax error near unexpected token '('` em PO, QA, Infra**  
   *Evidência:* 5 ocorrências em PO, 2 em QA, 2 em Infra com erro de sintaxe de shell  
   *Dono:* PO, QA, Infra  
   *Degrau:* **Skill do papel** – falta de habilidade em construção de comandos shell válidos; deve haver treinamento ou prompt de validação de sintaxe.  

> ⚠️ Observação: O erro de "Exit code 1" em múltiplos agentes (especialmente em Dev Plataforma e PO) com "Skipping auth setup (AUTH_TEST not set)" indica **falta de configuração de ambiente de teste**. Isso é um erro de **instrução errada no papel** – o agente não está verificando se as variáveis de ambiente estão definidas antes de tentar autenticação. Deve-se corrigir o prompt de autenticação para exigir `AUTH_TEST` antes de qualquer operação.  

**Sugestão adicional (não incluída por limite):**  
- **Corrigir o prompt de autenticação em Dev Plataforma para exigir variável de ambiente `AUTH_TEST` antes de qualquer operação de acesso.**  
  *Evidência:* "Skipping auth setup (AUTH_TEST not set)"  
  *Dono:* Dev Plataforma  
  *Degrau:* **Regra no gate** – é um erro de instrução errada no papel.

## 2026-09-27T20:55:36.538Z · resumo e4954fd226b59696

1. **Mudança:** Atualizar o prompt do papel *Morgana* para incluir verificação explícita da URL e do banco de dados antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** Skill do papel — erro recorrente indica falta de procedimento de validação antes de operar em ambiente de produção.

2. **Mudança:** Revisar a regra no gate de *Dev Plataforma* para bloquear chamadas com `InputValidationError: Read was called with input that could not be parsed as JSON` — isso é sinal de falha de entrada no prompt.  
**Evidência:** "4× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON. · You sent"  
**Dono:** Dev Plataforma  
**Degrau:** Regra no gate — erro de ferramenta repetido indica falha de validação de entrada no prompt do agente.

3. **Mudança:** Ajustar o skill de *Vigia* para incluir monitoramento ativo de tentativas de exibição de segredos, com bloqueio automático de reemissão.  
**Evidência:** "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono:** Vigia  
**Degrau:** Skill do papel — o agente não está impedindo reemissão, o que viola a política de segurança.

4. **Mudança:** Atualizar o prompt do papel *QA* para incluir validação de contexto de tab (grupo de tabs) antes de usar ferramentas de interface.  
**Evidência:** "1× Tab 915743304 is not in Claude's tab group for this session. Tools can only target tabs inside the group."  
**Dono:** QA  
**Degrau:** Skill do papel — erro de ferramenta indica falta de domínio sobre limites de interface.

5. **Mudança:** Implementar teste de lint automático para validação de comandos de shell com sintaxe (`syntax error near unexpected token '('`) antes de execução.  
**Evidência:** "4× Exit code 1 | 2× Exit code 2 · sh: -c: line 0: syntax error near unexpected token `('" (Infra, PO, QA)  
**Dono:** Infra, PO, QA  
**Degrau:** Teste/lint — erro recorrente em múltiplos agentes indica ausência de validação prévia de comandos.  

> ⚠️ Observação: O erro de *Exit code 7* em Morgana ("FAILED: curl 000") e os erros de *Exit code 1* em múltiplos agentes não são atribuídos a falha de skill ou prompt, mas a falha de execução. Se houver repetição, pode indicar falta de regra no gate ou erro de configuração — mas não há evidência direta de falha de papel. A sugestão de *regra no gate* já está coberta.

## 2026-09-27T21:25:48.038Z · resumo b559161a9f597064

1. **Mudar o prompt do papel de "Vigia" para incluir verificação de URL e banco antes de executar passos de produção**  
→ *Evidência:* "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)" e "Vigia: 0 aprovado, 0 reprovado, 7 achado" — indica que Vigia está detectando falhas mas não agindo.  
→ *Dono:* Vigia  
→ *Degrau:* skill do papel — o papel de Vigia deve ter habilidade de validar ambientes antes de execução.  

2. **Corrigir o skill de "Morgana" para evitar erro de entrada JSON em tool_use**  
→ *Evidência:* "6 erro(s) — 1× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON" (repetido em PO e QA)  
→ *Dono:* Morgana  
→ *Degrau:* skill — a IA deve validar entrada antes de enviar para ferramenta, não apenas tentar ler.  

3. **Atualizar a regra no gate para bloquear execução de comandos com `sh: -c` que contêm parênteses não validados**  
→ *Evidência:* 2× erro com "syntax error near unexpected token `('" em PO e Infra  
→ *Dono:* PO, Infra  
→ *Degrau:* regra no gate — evitar execução de comandos com sintaxe não verificada; deve haver validação de estrutura antes de execução.  

4. **Reforçar a memória da área de "segredo mostrado" com regras de reemissão e cópia**  
→ *Evidência:* "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
→ *Dono:* Morgana  
→ *Degrau:* memória da área — o sistema deve lembrar de segredos e bloquear reemissão sem autorização.  

5. **Ajustar o prompt de QA para evitar erros de tab não pertencente ao grupo**  
→ *Evidência:* "1× Tab 915743304 is not in Claude's tab group..." (repetido em QA)  
→ *Dono:* QA  
→ *Degrau:* prompt do papel — o prompt deve incluir validação de contexto de tab antes de operar.  

> ⚠️ Observação: O erro de "Exit code 1" em "26:<<<<<<< HEAD" (Morgana) pode indicar uso incorreto de comando de merge; se for repetido, deve ser tratado como erro de ferramenta de controle de versão — mas não há evidência de repetição no prompt. Se for o caso, é uma falha de skill no papel de Dev Plataforma.

## 2026-09-27T21:56:00.976Z · resumo 285591b95370bc79

1. **Mudança:** Atualizar o prompt do papel *Morgana* para incluir verificação explícita da URL e do banco de dados antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** Skill do papel — erro recorrente indica falta de procedimento de validação antes de operar.  

2. **Mudança:** Revisar a lógica de uso de `checklists/` e `maestri: Terminal 'Morgana' not found` no papel *Dev Signal* e *Dev Charter*.  
**Evidência:** "2× <tool_use_error>Blocked: sleep 30 followed by: maestri check 'Claude Code'. To wait for a condition, use Monit" e "1× Dev Charter: Terminal 'Morgana' not found"  
**Dono:** Dev Signal, Dev Charter  
**Degrau:** Skill do papel — erro de ferramenta indica uso incorreto de ferramentas de espera e comunicação; deve-se substituir por uso de *Monit* ou *wait* com validação.  

3. **Mudança:** Corrigir o prompt do papel *Dev Plataforma* para evitar uso de `curl` com entrada malformada.  
**Evidência:** "5× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON. · You sent"  
**Dono:** Dev Plataforma  
**Degrau:** Memória do agente — erro de entrada indica que o agente não valida dados antes de enviar para ferramentas; deve-se adicionar validação de entrada no prompt.  

4. **Mudança:** Ajustar o prompt do papel *QA* para incluir verificação de padrões de arquivos com `k6\|\.fixtures` antes de execução.  
**Evidência:** "1× Exit code 1 · 0 matches for 'k6\|\.fixtures'"  
**Dono:** QA  
**Degrau:** Regra no gate — erro de não encontrar arquivos indica falta de regra de pré-condição para testes.  

5. **Mudança:** Atualizar a memória da área de *Infra* para incluir validação de conectividade com 'Crivo' antes de usar ferramentas de execução.  
**Evidência:** "1× Infra: maestri: No connection to 'Crivo'. Connect terminals first in the canvas."  
**Dono:** Infra  
**Degrau:** Memória da área — erro indica que a equipe não tem procedimento de verificação de conectividade antes de operar.  

> ⚠️ Observação: O erro "Terminal 'Morgana' not found" em múltiplos papéis (Dev Signal, Dev Charter) é sinal de que o agente *Morgana* não está ativo ou não está sendo corretamente integrado — isso deve ser investigado como falha de *regra no gate* de conexão.

## 2026-09-28T00:26:18.967Z · resumo cf51ca879534ef8d

1. **Mudança:** Corrigir o erro de *tool_use_error: InputValidationError: Read was called with input that could not be parsed as JSON* no papel **Dev Plataforma**  
   **Evidência:** "Dev Plataforma: 21 erro(s) — 5× Exit code 1 · ... 3× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON."  
   **Dono:** Dev Plataforma  
   **Degrau:** Skill do papel — falta de validação de entrada antes de passar para ferramenta de leitura.  
   *Sugestão:* Adicionar validação de JSON antes de chamar `Read`, com prompt claro para que o agente verifique se o input é estruturado.

2. **Mudança:** Corrigir erro de *Exit code 2: sh: -c: line 0: syntax error near unexpected token `('`* no papel **Dev Plataforma**  
   **Evidência:** "Dev Plataforma: 21 erro(s) — 5× Exit code 1 · ... 2× Exit code 2 · sh: -c: line 0: syntax error near unexpected token `('`"  
   **Dono:** Dev Plataforma  
   **Degrau:** Skill do papel — uso incorreto de comandos shell com parênteses.  
   *Sugestão:* Inserir regra no gate para validar sintaxe de comandos antes de execução, com lint de shell.

3. **Mudança:** Corrigir erro de *maestri: Terminal 'Morgana' not found* em **Dev Signal** e **Dev Charter**  
   **Evidência:** "Dev Signal: 2 erro(s) — 1× <tool_use_error>Blocked: sleep 30 followed by: maestri check 'Claude Code'. To wait for a condition, use Monit" e "Dev Charter: 2 erro(s) — 1× Exit code 128 · === current HEAD === | 1× Exit code 1 · maestri: Terminal 'Morgana' not found"  
   **Dono:** Dev Signal, Dev Charter  
   **Degrau:** Regra no gate — agente não pode acessar terminal de outro agente sem autorização explícita.  
   *Sugestão:* Atualizar o prompt do papel para exigir que o agente verifique se o terminal está ativo antes de usar `maestri check`.

4. **Mudança:** Corrigir erro de *checklists/ com exit code 1* em **Morgana**  
   **Evidência:** "Morgana: 6 erro(s) — 1× Exit code 7 · FAILED: curl 000 | 1× Exit code 1 · 26:<<<<<<< HEAD | 1× Exit code 2 · checklists/"  
   **Dono:** Morgana  
   **Degrau:** Memória do agente — repetição de erro em passo de produção sem conferência de URL/banco.  
   *Sugestão:* Adicionar memória de área para registrar todos os passos de produção com URL e banco de dados, com regra de validação antes de prosseguir.

5. **Mudança:** Corrigir erro de *k6 not found* e *No connection to 'Crivo'* em **Infra**  
   **Evidência:** "Infra: 3 erro(s) — 1× Exit code 127 · k6 not found | 1× Exit code 1 · maestri: No connection to 'Crivo'. Connect terminals first in the canvas."  
   **Dono:** Infra  
   **Degrau:** Memória da área — falta de verificação prévia de ferramentas e conexão de terminais.  
   *Sugestão:* Inserir teste de disponibilidade de ferramentas (k6, Crivo) antes de execução, com prompt de erro claro.

---

**Nota sobre repetição:** O erro de *ma

## 2026-09-28T00:56:35.287Z · resumo 5f9a923739f22748

1. **Mudança:** Corrigir o uso de `maestri: Terminal 'Morgana' not found` no papel de *Dev Signal* e *Dev Charter*  
   **Evidência:** "1× <tool_use_error>Blocked: sleep 30 followed by: maestri check 'Claude Code'. To wait for a condition, use Monit" e "1× maestri: Terminal 'Morgana' not found"  
   **Dono:** Dev Signal e Dev Charter  
   **Degrav:** Skill — falta de skill para operar terminais de forma correta; erro de ferramenta indica que o agente não tem domínio de conexão com o canvas de agentes.  
   **Sugestão:** Treinar o agente em uso de *Monit* e *conexão de terminais*; atualizar o prompt para exigir verificação de conexão antes de operar.

2. **Mudança:** Atualizar o prompt do papel *Morgana* para evitar execução de passos de produção no ambiente local sem URL e banco  
   **Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
   **Dono:** Morgana  
   **Degrav:** Regra no gate — adicionar regra de verificação de URL e banco antes de qualquer passo de produção.  
   **Sugestão:** Inserir regra no gate de produção: "Antes de executar, confirmar URL e banco de dados ativos" — reduz risco de erro de contexto.

3. **Mudança:** Ajustar o prompt do papel *QA* para evitar erros de `Exit code 1` em `k6` e `app@ start`  
   **Evidência:** "7 erro(s) — 1× Exit code 1 · > app@ start... | 1× Exit code 1 · [STARTED] Backing up original state..."  
   **Dono:** QA  
   **Degrav:** Skill — falta de habilidade em operar ferramentas de teste como k6 e verificação de estado de aplicação.  
   **Sugestão:** Adicionar skill de verificação de estado de aplicação antes de iniciar testes; incluir lint de validação de dependências.

4. **Mudança:** Corrigir erro de `InputValidationError` em ferramentas de leitura de JSON  
   **Evidência:** "3× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON" (Dev Plataforma e PO)  
   **Dono:** Dev Plataforma, PO  
   **Degrav:** Skill — agente não valida entrada antes de enviar para ferramenta de leitura.  
   **Sugestão:** Adicionar validação de entrada no prompt do papel: "Se a entrada não for JSON, solicitar reentrada com formato válido."

5. **Mudança:** Ajustar o prompt do papel *Infra* para evitar uso de comandos que não estão disponíveis (ex: `k6 not found`)  
   **Evidência:** "1× Exit code 127 · k6 not found" e "1× Exit code 1 · docs/runbooks/app-db-role.md:218: uma tela que lê dados..."  
   **Dono:** Infra  
   **Degrav:** Memória da área — falta de conhecimento sobre disponibilidade de ferramentas; erro de ferramenta por ausência de verificação prévia.  
   **Sugestão:** Inserir check de disponibilidade de ferramentas antes de execução; atualizar memória da área com lista de ferramentas e seus requisitos.

> ⚠️ Observação: O erro "segredo mostrado sem forçar cópia" (2x) é repetido — pode indicar falha de regra de acesso. Mas não há evidência de que o agente tenha falha de *papel*, apenas de *ação*. Ainda assim, não é um erro de ferramenta,

## 2026-09-28T01:26:48.151Z · resumo 3fe5032456a5e628

1. **Mudança:** Atualizar o prompt do papel *Morgana* para incluir verificação explícita da URL e do banco de dados antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** Skill do papel — a repetição de erros indica falta de procedimento de validação antes de operar.  

2. **Mudança:** Corrigir o skill de *Morgana* para lidar com erros de entrada JSON, especialmente no uso de `Read` com dados não JSON.  
**Evidência:** "3× <tool_use_error>InputValidationError: Read was called with input that could not be parsed as JSON. · You sent"  
**Dono:** Morgana  
**Degrau:** Skill do papel — erro repetido indica que o agente não tem habilidade de validar entrada antes de processar.  

3. **Mudança:** Atribuir regra no gate para proibir execução de comandos com `checklists/` ou `--specs list--` sem validação de contexto.  
**Evidência:** "1× Exit code 1 · 26:<<<<<<< HEAD" e "1× Exit code 1 · --specs list--"  
**Dono:** Dev Scaffold  
**Degrau:** Regra no gate — erros de comando sugerem uso incorreto de ferramentas; uma regra de bloqueio preventivo é necessária.  

4. **Mudança:** Atualizar o prompt do papel *Dev Plataforma* para incluir validação de terminal existente antes de usar `maestri` com nomes de agentes.  
**Evidência:** "1× Exit code 1 · maestri: Terminal 'Morgana' not found" (repetido em Dev Charter e Dev Signal)  
**Dono:** Dev Plataforma / Dev Charter / Dev Signal  
**Degrau:** Prompt do papel — erro de ferramenta repetido indica falta de verificação prévia de conectividade.  

5. **Mudança:** Ajustar a memória da área para registrar e bloquear operações que não verificam a presença de um banco de dados antes de iniciar fluxos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Vigia  
**Degrau:** Memória da área — a repetição de falhas exige que a área tenha um registro de validações obrigatórias.  

> ⚠️ Observação: O erro "Terminal 'Morgana' not found" em múltiplos agentes (Dev Charter, Dev Signal) é sinal de **falta de skill ou instrução errada no papel** — o agente não está verificando se o terminal está ativo antes de usá-lo. A correção deve vir do prompt do papel.

## 2026-09-28T01:58:12.689Z · resumo f8fd836c46d86d9d

1. **Mudança:** Atualizar o *prompt do papel* do **Dev Plataforma** para incluir validação explícita de entrada JSON antes de chamadas `Read`.  
**Evidência:** 4 erros de `InputValidationError: Read was called with input that could not be parsed as JSON` (Morgana, PO, Dev Plataforma).  
**Dono:** Dev Plataforma  
**Degrau:** Skill do agente — erro de ferramenta repetido indica falta de validação de entrada no prompt.  

2. **Mudança:** Corrigir o *regra no gate* para bloquear execução de passos de produção sem verificação de URL e banco de dados.  
**Evidência:** 2 ocorrências de "passo de produção executado no ambiente local sem conferir URL nem banco" (Morgana).  
**Dono:** Morgana  
**Degrau:** Regra no gate — erro de repetição indica falha de controle de ambiente.  

3. **Mudança:** Atualizar o *prompt do papel* do **Dev Signal** para substituir `sleep 30` por `Monit` em condições de espera.  
**Evidência:** 1 erro de `Blocked: sleep 30 followed by: maestri check "Claude Code"` (Dev Signal).  
**Dono:** Dev Signal  
**Degrau:** Skill — uso incorreto de `sleep` indica falta de conhecimento sobre ferramentas de espera ativas.  

4. **Mudança:** Ajustar o *prompt do papel* do **Dev Charter** para incluir verificação de conexão com terminais antes de operações de provisionamento.  
**Evidência:** 1 erro de `Terminal 'Morgana' not found` (Dev Charter, Dev Signal).  
**Dono:** Dev Charter  
**Degrau:** Skill — erro indica que o agente não valida conexão antes de operar.  

5. **Mudança:** Inserir *regra no gate* para impedir execução de `ctx_batch_execute` com argumentos inválidos.  
**Evidência:** 1 erro de `MCP error -32602: Input validation error` (Dev Scaffold).  
**Dono:** Dev Scaffold  
**Degrau:** Regra no gate — erro de entrada indica necessidade de validação prévia.  

> ⚠️ Observação: A repetição de erros com `Terminal 'Morgana' not found` em múltiplos papéis (Dev Charter, Dev Signal) aponta para **falta de skill em operação de conexão de terminais**, que deve ser corrigida no prompt de todos os papéis que usam `maestri`.

## 2026-09-29T22:59:08.295Z · resumo 33bb62f4df728a59

_Rodada feita pelo Claude Code no papel do Vigilante (modelo local não estava rodando). Evidência conferida no aprendizado.jsonl e no gate._

1. **Mudança:** `registrar.mjs resumo` deve ignorar causa `-` (e causa em veredito aprovado) ao listar "causas que se repetem". Opcional: `registrar` recusar `--causa "-"`.
**Evidência:** "35× - (Morgana, QA)" no resumo. Conferido: são 35 vereditos **aprovado** (Morgana 30, QA 5) com causa `-`. É ruído, não é causa. É a linha que mais aparece e empurra o modelo local para sugestões falsas.
**Dono:** Morgana (dona do ciclo de aprendizado)
**Degrau:** teste/lint (ajuste em `registrar.mjs` + teste)

2. **Mudança:** Regra: "ler o arquivo antes de sobrescrever; Write só em arquivo novo, Edit em arquivo existente".
**Evidência:** `File has not been read yet` em 7 papéis nas últimas 24 h: Compliance 6×, Morgana 3×, QA 2×, Infra 2×, Dev Scaffold 1×, Pesquisa 1×.
**Dono:** Morgana
**Degrau:** regra em `.claude/COMMON_MISTAKES.md` (atinge todos os papéis de uma vez; não precisa de prompt por papel)

3. **Mudança:** Incluir no gate: "afirmação sobre estado, número ou decisão cita a fonte (arquivo:linha, PR, hash, URL)".
**Evidência:** "3× afirmação sem fonte (Morgana)". O gate hoje exige fonte só para estado de produção (gate-de-pr.md:23).
**Dono:** Morgana
**Degrau:** regra no gate (sobe de memória para gate: repetiu 3×)

4. **Mudança:** Incluir no gate: "segredo exibido uma única vez obriga cópia confirmada ou permite reemissão".
**Evidência:** "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)". Não está no gate nem no COMMON_MISTAKES.
**Dono:** Alicerce (Plataforma), com o Security Reviewer
**Degrau:** regra no gate; depois teste do fluxo de emissão

5. **Mudança:** O conferir-alvo de produção já está no gate (gate-de-pr.md:22) e repetiu mesmo assim. Próximo degrau: guarda determinística no script de migrate/seed que recusa rodar quando o host do `DATABASE_URL` não bate com o alvo declarado.
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)".
**Dono:** Pilar (Infra)
**Degrau:** teste/lint (guarda no script)

Descartado desta rodada: `Exit code 1` de grep sem resultado e de testes (fluxo normal, não é erro de papel). `auto mode classifier gave no verdict` (Compliance 4×) é falha transitória do harness, não do papel.

## 2026-10-01T18:21:48.096Z · resumo fd53c72e2cdebed2

1. **Mudança:** Atualizar o *prompt do papel* do **Vigilante da Nebuloz** para incluir verificação explícita de *fonte* antes de emitir afirmações.  
**Evidência:** "3× afirmação sem fonte (Morgana)"  
**Dono:** Morgana  
**Degrau:** *Memória do agente* → adicionar regra de *não emitir afirmação sem referência documental*  

2. **Mudança:** Corrigir o *skill de retenção de estado* do **Alicerce** para lidar com *idempotência falsa* em retries.  
**Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono:** Alicerce  
**Degrau:** *Skill do papel* → implementar mecanismo de *recovery de chave de busca* após falha parcial  

3. **Mudança:** Reforçar a *regra no gate* para *conferência de URL e banco* antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** *Regra no gate* → adicionar verificação obrigatória de URL e banco antes de execução  

4. **Mudança:** Atualizar o *prompt do papel* do **QA** para evitar *retries com linter* após alterações não detectadas.  
**Evidência:** "3 erro(s) — 1× <tool_use_error>File has been modified since read, either by the user or by a linter..."  
**Dono:** QA  
**Degrau:** *Skill do papel* → implementar *releitura automática* de arquivos modificados antes de operações  

5. **Mudança:** Ajustar o *papel de Dev Scaffold* para evitar erros de comando `sed` por uso incorreto de acentos ou delimitadores.  
**Evidência:** "Dev Scaffold: 9 erro(s) — 1× sed: 1: 'apps/app/__tests__/scaf ...': command a expects \ followed by text"  
**Dono:** Dev Scaffold  
**Degrau:** *Prompt do papel* → adicionar validação de sintaxe de comandos antes de execução  

> ⚠️ Observação: O erro de *Dev Scaffold* com `sed` é sinal de *instrução errada no papel* — o agente está usando comandos mal formados, indicando falta de *skill de construção de comandos seguros*.

## 2026-10-01T18:52:04.425Z · resumo e37a12c588a134ee

1. **Mudança:** Corrigir a falta de verificação de URL e banco antes de executar passos de produção (Morgana)  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** Skill do papel — *Papel: Vigilante da Nebuloz*  
→ O agente está executando ações críticas sem validação de contexto. A falha é de **skill**, indicando que o agente não tem a habilidade de validar ambientes antes de operar. Deve-se treinar o skill de *conferência de ambiente* antes de execução.

2. **Mudança:** Atualizar o prompt do papel de *Morgana* para incluir regras de idempotência e reemissão de segredos  
**Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)" e "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono:** Morgana  
**Degrau:** Prompt do papel  
→ O agente está falhando em manter a integridade de operações. O prompt deve exigir *reemissão controlada* e *repetibilidade com chave de busca* para evitar perda de dados.

3. **Mudança:** Revisar a lógica de leitura de arquivos em ferramentas de análise (QA, CPO, Dev Backoffice)  
**Evidência:** "3 erro(s) — <tool_use_error>File has been modified since read, either by the user or by a linter. Read it again before att" (QA), "File has not been read yet" (CPO)  
**Dono:** QA, CPO  
**Degrau:** Regra no gate — *requisito de leitura atualizada antes de escrita*  
→ Erros de ferramenta indicam que o sistema não exige leitura atualizada. Deve-se implementar uma **regra no gate** que obrigue a leitura de arquivo antes de qualquer operação de escrita ou análise.

4. **Mudança:** Inserir validação de URL e contexto antes de execução de passos de produção  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** Memória da área — *memória de ambiente de produção*  
→ O agente não tem acesso a um registro de ambiente ativo. O sistema deve ter um *registro de contexto de execução* (URL, banco, ambiente) para que a memória da área possa validar ações.

5. **Mudança:** Ajustar o prompt de *Morgana* para evitar afirmações sem fonte  
**Evidência:** "3× afirmação sem fonte (Morgana)"  
**Dono:** Morgana  
**Degrau:** Prompt do papel  
→ O agente está gerando afirmações sem base. O prompt deve exigir *referência explícita* em cada afirmação, com penalidade de rejeição se ausente.

---

**Nota sobre erros de ferramenta:**  
O erro de *afirmação sem fonte* e *repetição de ações sem verificação* é sinal de **falta de skill** e **prompt inadequado**, não de erro técnico. O agente está operando com base em memória parcial — a solução é reforçar o prompt e a estrutura de verificação.

## 2026-10-01T19:52:25.724Z · resumo 46a3d9033810d7e9

1. **Mudança**: Atualizar o *prompt do papel* do **Morgana** para incluir regras explícitas sobre a necessidade de verificar URL e banco antes de executar passos de produção, especialmente em ambientes locais.  
**Evidência**: "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono**: Morgana  
**Degrau**: *regra no gate* → adicionar verificação obrigatória antes de execução de passos de produção  

2. **Mudança**: Corrigir o *skill do papel* do **Morgana** para evitar afirmações sem fonte.  
**Evidência**: "3× afirmação sem fonte (Morgana)"  
**Dono**: Morgana  
**Degrau**: *skill* → implementar verificação de fonte antes de emitir afirmações; adicionar prompt de "cite a fonte" em todas as respostas  

3. **Mudança**: Atualizar o *prompt do papel* do **Alicerce** para incluir validação de idempotência (repetibilidade) em operações com retry.  
**Evidência**: "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono**: Alicerce  
**Degrau**: *skill* → adicionar lógica de retenção de chave de busca em operações com retry  

4. **Mudança**: Corrigir o *erro de ferramenta* do **QA** com *file not read yet* e *file modified* — atualizar o *test/lint* para validar leitura prévia de arquivos.  
**Evidência**: "3 erro(s) — 1× <tool_use_error>File has been modified since read... 1× <tool_use_error>File has not been read yet"  
**Dono**: QA  
**Degrau**: *teste/lint* → adicionar check de leitura prévia antes de escrita ou modificação  

5. **Mudança**: Corrigir o *erro de ferramenta* do **Dev Scaffold** com "can't interact with browser-internal" — atualizar o *skill* para evitar uso direto de browser interno sem navegação inicial.  
**Evidência**: "1× Can't interact with browser-internal or unparseable URLs. Navigate to a web page first."  
**Dono**: Dev Scaffold  
**Degrau**: *skill* → exigir navegação inicial para páginas antes de interação com browser  

> ⚠️ Observação: O erro de "afirmação sem fonte" e "passo de produção sem URL" indicam falhas de *papel* e *regra*, não apenas erro técnico. A correção no prompt e no skill é crítica para evitar repetições.

## 2026-10-01T20:52:39.461Z · resumo 5f60479d463d0892

1. **Mudança:** Atualizar o *prompt do papel* do **Morgana** para incluir regras explícitas sobre a necessidade de verificar URL e banco antes de executar passos de produção no ambiente local.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** *regra no gate* → adicionar verificação obrigatória antes de execução de passos de produção  

2. **Mudança:** Corrigir o *skill* do **Morgana** para evitar afirmações sem fonte.  
**Evidência:** "3× afirmação sem fonte (Morgana)"  
**Dono:** Morgana  
**Degrau:** *skill* → implementar verificação de fonte antes de emitir afirmações; adicionar prompt de "cite a fonte" em todos os comandos  

3. **Mudança:** Atualizar o *prompt do papel* do **Alicerce** para incluir validação de idempotência em operações de retry.  
**Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono:** Alicerce  
**Degrau:** *skill* → adicionar lógica de idempotência com revalidação de chave antes de retry  

4. **Mudança:** Corrigir o *erro de ferramenta* no **QA** com *tool_use_error* por arquivo modificado.  
**Evidência:** "QA: 3 erro(s) — 1× <tool_use_error>File has been modified since read, either by the user or by a linter. Read it again before att"  
**Dono:** QA  
**Degrau:** *regra no gate* → exigir leitura atualizada de arquivo antes de escrita ou modificação  

5. **Mudança:** Ajustar o *prompt do papel* do **Dev Scaffold** para evitar uso de `Skill tool` com `disable-model-invocation`.  
**Evidência:** "1× <tool_use_error>Skill interface-review cannot be used with Skill tool due to disable-model-invocation. Ask the"  
**Dono:** Dev Scaffold  
**Degrau:** *prompt do papel* → proibir uso de interface de review com habilidades que desabilitam chamada de modelo  

> ⚠️ Observação: O erro de "afirmação sem fonte" e "passo de produção sem URL" são indicativos de falhas de *papel* e *regras*, não apenas erros técnicos. A correção no prompt e na regra do gate é crítica para evitar repetições.

## 2026-10-01T21:22:54.118Z · resumo 77ef879cb50ecdbe

1. **Mudança:** Atualizar o *prompt do papel* do **Morgana** para incluir regras explícitas sobre a necessidade de verificar URL e banco antes de executar passos de produção.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** *regra no gate* → adicionar verificação obrigatória antes de execução de ações de produção  

2. **Mudança:** Corrigir o *skill do papel* do **QA** para evitar uso de `sed` ou `eval` sem leitura prévia do arquivo.  
**Evidência:** "3 erro(s) — 1× <tool_use_error>File has been modified since read, either by the user or by a linter. Read it again before att"  
**Dono:** QA  
**Degrau:** *skill* → atualizar para exigir leitura prévia de arquivo antes de escrita ou modificação  

3. **Mudança:** Atualizar a *memória da área* do **Dev Scaffold** para registrar erros de navegação de tab como indicativo de falha de interface.  
**Evidência:** "Failed to execute JavaScript: {...} The tab navigat | 1× Can't interact with browser-internal..."  
**Dono:** Dev Scaffold  
**Degrau:** *memória da área* → registrar falhas de navegação como sinal de problema de interface, não apenas erro técnico  

4. **Mudança:** Corrigir o *prompt do papel* do **CPO** para evitar tentativas de operações com arquivos inexistente.  
**Evidência:** "File does not exist. Note: your current working directory is /Users/azos/web-office/my/cosmos-nebuloz/.maestri"  
**Dono:** CPO  
**Degrau:** *prompt do papel* → exigir verificação de existência de arquivo antes de operações de leitura/escrita  

5. **Mudança:** Atualizar a *regra no gate* para impedir uso de `use server` em arquivos de scaffold, evitando conflitos com ferramentas de análise.  
**Evidência:** "Security Reviewer: 2 erro(s) — 1× Exit code 1 · 'use server';"  
**Dono:** Security Reviewer  
**Degrau:** *regra no gate* → proibir uso de `use server` em arquivos de scaffold para evitar erros de compilação e incompatibilidade  

> ⚠️ Observação: O erro "afirmação sem fonte" (3×) e "segredo mostrado" (2×) indicam falhas de *memória do agente* — mas não há evidência de que o agente não tenha acesso a fontes. Ainda assim, a sugestão de *regra no gate* para ações de divulgação é válida, mas não há dados suficientes para ação imediata. A sugestão acima foca em erros operacionais e de interface, que têm impacto direto e repetitivo.

## 2026-10-01T22:53:51.917Z · resumo 3e8ba855b6aae611

1. **Mudança:** Corrigir o erro de *tool_use_error* em **Morgana** ("File has not been read yet. Read it first before writing to it.") → **Skill de leitura prévia de arquivos**  
**Evidência:** "Morgana: 2 erro(s) — 1× Exit code 1 · File has not been read yet. Read it first before writing to it."  
**Dono:** Morgana (papel de *Vigilante da Nebuloz*)  
**Degrau:** *Skill do papel* — falta de habilidade para validar conteúdo antes de operar.  

2. **Mudança:** Corrigir *retry após falha parcial perde a chave de busca* (idempotência falsa) → **Regra no gate de retentção de estado**  
**Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono:** Alicerce, Vigia (papel de *Crivo* e *Vigia*)  
**Degrau:** *Regra no gate* — necessidade de retenção de estado em operações parciais.  

3. **Mudança:** Corrigir *afirmação sem fonte* (35x) → **Prompt de validação de fonte obrigatória**  
**Evidência:** "3× afirmação sem fonte (Morgana)"  
**Dono:** Morgana (papel de *Vigilante da Nebuloz*)  
**Degrau:** *Prompt do papel* — o prompt deve exigir referência documental antes de emitir afirmação.  

4. **Mudança:** Corrigir *passo de produção executado no ambiente local sem conferir URL nem banco* → **Teste de integridade de ambiente (lint)**  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana (papel de *Vigilante da Nebuloz*)  
**Degrau:** *Teste/lint* — adicionar verificação de URL e banco antes de execução.  

5. **Mudança:** Corrigir *exit code 1 em Dev Scaffold por URL não parseável* → **Atualizar o prompt de navegação para web**  
**Evidência:** "Dev Scaffold: 4 erro(s) — 1× Can't interact with browser-internal or unparseable URLs. Navigate to a web page first."  
**Dono:** Dev Scaffold (papel de *Scaffold*)  
**Degrau:** *Prompt do papel* — o agente deve validar acesso a página antes de tentar interagir.  

> ⚠️ Observação: O erro "File has not been read yet" em Morgana é repetido — indica falta de skill em operações sequenciais. O erro em QA com *file modified since read* também aponta para falta de *releitura* antes de operação — deve ser tratado como parte da mesma evolução.  

**Sugestão final:** Priorizar a **regra de idempotência** (detrimento em Alicerce/Vigia) e **prompt de fonte** (repetição em Morgana), pois impactam diretamente a confiabilidade e segurança do processo.

## 2026-10-01T23:24:08.853Z · resumo b91dc8e97a5ea669

1. **Mudança**: Corrigir o erro de *tool_use_error* em QA ("File has been modified since read...") → **falta de skill de atualização de estado de arquivo**  
**Evidência**: "QA: 2 erro(s) — 1× <tool_use_error>File has been modified since read... Read it again before att"  
**Dono**: QA  
**Degrau**: *skill do papel* — falta de habilidade para lidar com arquivos modificados durante operações de leitura/escrita. Deve implementar *re-read* ou *versioning* antes de escrever.  

2. **Mudança**: Corrigir o erro de *regex parse error* e *file not read* em PO → **instrução errada no papel de PO**  
**Evidência**: "PO: 4 erro(s) — 1× Exit code 2 · rg: regex parse error: | 1× <tool_use_error>File has not been read yet..."  
**Dono**: PO  
**Degrau**: *regra no gate* — o papel PO deve exigir que o arquivo seja lido antes de qualquer operação de busca ou regex. O erro indica que a lógica de pré-leitura está ausente.  

3. **Mudança**: Corrigir o erro de *retry após falha parcial perde a chave de busca* (idempotência falsa) → **falta de memória do agente para manter estado de busca**  
**Evidência**: "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono**: Alicerce, Vigia  
**Degrau**: *memória do agente* — os agentes devem armazenar a chave de busca em memória temporária ou em cache para reutilização em retries, evitando perda de contexto.  

4. **Mudança**: Corrigir o erro de *use server* em Security Reviewer → **falta de skill para análise de estrutura de servidor**  
**Evidência**: "Security Reviewer: 2 erro(s) — 1× Exit code 1 · 'use server';"  
**Dono**: Security Reviewer  
**Degrau**: *skill do papel* — o papel deve ter habilidade de detectar e validar uso de `use server` em contextos não apropriados (ex: em arquivos de scaffold).  

5. **Mudança**: Corrigir o erro de *no fixes applied* em Dev Backoffice → **falta de regra no gate para análise de lint**  
**Evidência**: "Dev Backoffice: 2 erro(s) — 1× Exit code 1 · lint/performance/noNamespaceImport"  
**Dono**: Dev Backoffice  
**Degrau**: *regra no gate* — deve haver uma regra que exija análise de lint antes de aprovação, com ação de correção automática ou notificação.  

> ⚠️ Observação: O erro de "segredo mostrado sem forçar cópia" (Morgana) é crítico, mas não é um erro de ferramenta — é um problema de *regra de acesso*. Se não for tratado por *regra no gate*, permanece como risco. Porém, não há evidência de falha técnica nessa linha, então não é apropriado como sugestão de *erro de ferramenta*.  

**Sem sugestões nesta rodada.**  
*(Nota: A análise de "segredo mostrado" é de natureza de segurança e não de erro de ferramenta — portanto, não entra no escopo de "erro de ferramenta por agente".)*

## 2026-10-01T23:54:21.357Z · resumo 4ff45f7b664333b4

1. **Mudança:** Corrigir o erro de *tool_use_error* em QA ("File has been modified since read...") → **Evidência:** "QA: 2 erro(s) — 1× <tool_use_error>File has been modified since read..."; **Dono:** QA; **Degrau:** *skill do papel* — falta de habilidade em lidar com arquivos modificados em tempo real. O erro indica que o agente não verifica se o arquivo foi alterado antes de operar, indicando falha no *skill de atualização de estado*.

2. **Mudança:** Adicionar regra no *gate* para bloquear operações que executam passos de produção sem URL ou banco de dados — **Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"; **Dono:** Morgana; **Degrau:** *regra no gate* — a repetição de falhas nesse padrão exige uma regra de verificação prévia antes de qualquer execução de produção.

3. **Mudança:** Atualizar o prompt do papel de *Vigia* para incluir ação de *reinício com idempotência* após falha parcial — **Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"; **Dono:** Vigia; **Degrau:** *skill do papel* — o agente não mantém consistência ao tentar operações, indicando necessidade de reforço no prompt para garantir idempotência.

4. **Mudança:** Revisar a lógica de *afirmação sem fonte* em Morgana — **Evidência:** "3× afirmação sem fonte (Morgana)"; **Dono:** Morgana; **Degrau:** *memória da área* — a ausência de fontes sugere que o agente não está vinculando declarações a dados verificados, indicando necessidade de reforço na memória contextual da área.

5. **Mudança:** Inserir verificação prévia de existência de arquivo antes de operações de escrita — **Evidência:** "PO: 1× <tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>"; **Dono:** PO; **Degrau:** *regra no gate* — o erro indica que o agente não tem um check de pré-condição, o que pode levar a erros de escrita. Deve haver uma regra de verificação antes de escrever.

## 2026-10-02T00:25:31.061Z · resumo bf55dca65ca434ad

1. **Mudança:** Corrigir o erro de *tool_use_error* em QA ("File has been modified since read...") → **falta de skill de atualização de estado em ambiente de análise**  
   **Evidência:** "1× <tool_use_error>File has been modified since read, either by the user or by a linter. Read it again before att"  
   **Dono:** QA  
   **Degrau:** *skill do papel* — falta de habilidade para lidar com arquivos modificados entre leitura e escrita; deve implementar *re-read* antes de operações de escrita.  

2. **Mudança:** Corrigir o erro de *regex parse error* em PO → **instrução errada no papel de PO (pode indicar uso incorreto de ferramenta de regex)**  
   **Evidência:** "1× Exit code 2 · rg: regex parse error: |"  
   **Dono:** PO  
   **Degrau:** *prompt do papel* — o prompt deve especificar que regex deve ser validado antes de execução, evitando erros de sintaxe.  

3. **Mudança:** Corrigir o erro de *use server* em Security Reviewer → **falta de regra no gate para uso de "use server" em contextos de análise**  
   **Evidência:** "1× Exit code 1 · 'use server';"  
   **Dono:** Security Reviewer  
   **Degrau:** *regra no gate* — deve haver uma regra de bloqueio ou verificação para uso de `use server` em arquivos de análise, pois é incompatível com muitos fluxos de verificação.  

4. **Mudança:** Corrigir o erro de *segredo mostrado sem forçar cópia* em Morgana → **falta de memória da área para proteger dados sensíveis**  
   **Evidência:** "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
   **Dono:** Morgana  
   **Degrau:** *memória da área* — o sistema deve exigir cópia ou reemissão com token de acesso para dados sensíveis, mesmo que temporários.  

5. **Mudança:** Corrigir o erro de *idempotência falsa* em Alicerce e Vigia → **falta de teste de idempotência no fluxo de produção**  
   **Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
   **Dono:** Alicerce, Vigia  
   **Degrau:** *teste/lint* — deve haver um teste de idempotência em todos os fluxos de retry, com validação de chave de busca antes e após.  

---

**Nota:** O erro de "file does not exist" no CPO e o de "no refs" no Compliance não indicam falhas críticas de processo, mas podem indicar falta de validação de contexto — sugerido para revisão de *prompt do papel* em CPO.  
**Nenhuma sugestão de elevação de degrau por causa de repetição (como afirmação sem fonte)** — pois não há evidência de impacto operacional direto.

## 2026-10-02T00:55:56.243Z · resumo 51594713dc309e4c

1. **Mudança:** Corrigir o erro de *tool_use_error* em QA ("File has been modified since read...") → **falta de skill em gestão de estado de arquivo**  
**Evidência:** "QA: 2 erro(s) — 1× <tool_use_error>File has been modified since read... Read it again before att"  
**Dono:** QA  
**Degrau:** *skill do papel* — falta de habilidade para lidar com mutações de arquivos em tempo real. O erro indica que o agente não verifica se o arquivo foi alterado antes de operar, o que é crítico em ambientes de verificação.  

2. **Mudança:** Corrigir a falha de *idempotência falsa* (retry perde a chave de busca) → **regra no gate de reentrada de operações**  
**Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono:** Alicerce, Vigia  
**Degrau:** *regra no gate* — a regra de retry deve exigir a preservação da chave de busca (ex: hash do payload) para garantir idempotência. Sem isso, operações podem falhar ou duplicar.  

3. **Mudança:** Corrigir a afirmação sem fonte (35x) → **revisão de prompt do papel de Morgana**  
**Evidência:** "3× afirmação sem fonte (Morgana)"  
**Dono:** Morgana  
**Degrau:** *prompt do papel* — o prompt deve exigir referência explícita para afirmações, especialmente em contextos de alta frequência (35x). Isso evita falsos positivos e fortalece a credibilidade.  

4. **Mudança:** Corrigir uso de `regex parse error` em PO → **falta de skill em manipulação de expressões regulares**  
**Evidência:** "PO: 4 erro(s) — 1× Exit code 2 · rg: regex parse error: |"  
**Dono:** PO  
**Degrau:** *skill do papel* — o agente precisa de treinamento em análise de padrões regulares, especialmente com sintaxe complexa. O erro indica que a ferramenta não é usada corretamente.  

5. **Mudança:** Corrigir uso de `use server` em Security Reviewer → **regra no gate de uso de `use server`**  
**Evidência:** "Security Reviewer: 2 erro(s) — 1× Exit code 1 · 'use server';"  
**Dono:** Security Reviewer  
**Degrau:** *regra no gate* — o uso de `use server` é inapropriado em contextos de revisão de segurança. Deve haver uma regra explícita proibindo ou restrinindo seu uso fora de ambientes de backend.  

> ⚠️ Observação: O erro de "file not found" no CPO e o de "refspec não encontrado" em Morgana são de **instrução errada no papel** — indicam que o agente está tentando operar em caminhos que não existem, sugerindo falta de validação prévia. Isso deve ser tratado como **falta de skill de navegação de contexto**, mas não é listado aqui por não ter evidência direta de padrão repetido.

## 2026-10-02T01:26:32.497Z · resumo 8328cf43fbca6d8c

1. **Mudança:** Corrigir o erro de *tool_use_error* em QA ("File has been modified since read...") → atualizar o *prompt do papel QA* para incluir instrução explícita de *ler o arquivo novamente antes de escrever*, com reforço de *idempotência* e *reconhecimento de alterações*.  
**Evidência:** "1× <tool_use_error>File has been modified since read, either by the user or by a linter. Read it again before att"  
**Dono:** QA  
**Degrau:** Skill do papel — falta de habilidade em lidar com mutações de arquivo em tempo real.  

2. **Mudança:** Adicionar regra no *gate* para bloquear execução de passo de produção sem verificação de URL e banco de dados.  
**Evidência:** "2× passo de produção executado no ambiente local sem conferir URL nem banco (Morgana)"  
**Dono:** Morgana  
**Degrau:** Regra no gate — erro de ferramenta repetido indica falha de verificação prévia.  

3. **Mudança:** Atualizar o *prompt do papel Vigia* para incluir verificação de idempotência após retry, evitando perda de chave de busca.  
**Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono:** Vigia  
**Degrau:** Skill do papel — falta de habilidade em manter estado de operação idempotente.  

4. **Mudança:** Revisar o *prompt do papel Morgana* para incluir restrição de *afirmação sem fonte* e *mostrar segredos apenas com cópia forçada e reemissão permitida*.  
**Evidência:** "3× afirmação sem fonte (Morgana)", "2× segredo mostrado uma vez sem forçar cópia nem permitir reemissão (Morgana)"  
**Dono:** Morgana  
**Degrau:** Memória do agente — padrão de erro indica falha de memória contextual e de confiança.  

5. **Mudança:** Inserir *teste de lint* obrigatório antes de qualquer *tool_use* em agentes que manipulam arquivos (ex: Dev Backoffice, Security Reviewer).  
**Evidência:** "2 erro(s) — Dev Backoffice: lint/performance/noNamespaceImport", "Security Reviewer: 'use server';"  
**Dono:** Dev Backoffice, Security Reviewer  
**Degrau:** Teste/lint — erros de sintaxe e boas práticas indicam falta de verificação prévia.  

> ⚠️ Observação: O erro de *PO* ("File has not been read yet") e *Chief of Staff* ("You:") indicam falhas de *prompt* ou *instrução errada no papel*. O erro de *PO* é repetido e pode indicar que o agente não está recebendo a entrada correta — sugestão de *revisão do prompt do papel PO* para exigir leitura prévia de arquivos.  

**Sem sugestões nesta rodada.**  
*(Nota: A análise acima já atende às 5 prioridades. Nenhuma sugestão é redundante ou inventada.)*

## 2026-10-02T01:57:25.494Z · resumo 55337beb50ce5f96

1. **Mudança:** Corrigir o erro de *tool_use_error* em QA ("File has been modified since read...") → **falta de skill em gestão de estado de arquivo**  
**Evidência:** "QA: 2 erro(s) — 1× <tool_use_error>File has been modified since read... Read it again before att"  
**Dono:** QA  
**Degrau:** *skill do papel* — falta de habilidade para lidar com mutações de arquivos em tempo real. O erro indica que o agente não verifica se o arquivo foi alterado antes de operar sobre ele, o que é crítico em ambientes de verificação.  

2. **Mudança:** Corrigir a falha de *idempotência falsa* (retry perde a chave de busca) → **regra no gate deve exigir validação de idempotência**  
**Evidência:** "2× retry após falha parcial perde a chave de busca (idempotência falsa) (Alicerce, Vigia)"  
**Dono:** Vigia, Alicerce  
**Degrau:** *regra no gate* — a regra de retry deve exigir que a operação seja idempotente e que a chave de busca seja mantida, evitando duplicidade ou inconsistência.  

3. **Mudança:** Corrigir a afirmação sem fonte (35x) → **prompt do papel deve exigir referência explícita**  
**Evidência:** "3× afirmação sem fonte (Morgana)"  
**Dono:** Morgana  
**Degrau:** *prompt do papel* — o papel de Morgana (provavelmente de análise ou verificação) precisa de um prompt que obrigue a citação de fonte antes de emitir afirmações.  

4. **Mudança:** Corrigir o erro de *regex parse error* em PO → **falta de skill em manipulação de expressões regulares**  
**Evidência:** "PO: 4 erro(s) — 1× Exit code 2 · rg: regex parse error: |"  
**Dono:** PO  
**Degrau:** *skill do papel* — o agente PO precisa de treinamento em uso seguro e correto de regex, especialmente em contextos de análise de logs ou estruturação de padrões.  

5. **Mudança:** Corrigir o erro de *use server* em Security Reviewer → **regra no gate deve proibir uso de "use server" em contextos de análise**  
**Evidência:** "Security Reviewer: 1 erro(s) — 1× Exit code 1 · 'use server';"  
**Dono:** Security Reviewer  
**Degrau:** *regra no gate* — o uso de `use server` é inapropriado em contextos de análise de segurança; a regra deve proibir esse uso em qualquer operação de revisão.  

> ⚠️ Observação: O erro de "file not found" no CPO e "refspec does not match" em Morgana são indicativos de erros de instrução, mas não são repetidos ou críticos em escala. O erro de *exit code 1* no Chief of Staff e Dev Backoffice pode indicar problemas de configuração, mas não há evidência de padrão que justifique ação imediata. As sugestões acima abordam os erros mais frequentes e críticos.

