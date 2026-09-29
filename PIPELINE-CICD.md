# Pipeline de CI/CD do Cosmos — do commit à produção

Arquivo: `.github/workflows/pipeline.yml` · Repositório: `PAVincius/cosmos-nebuloz`

```
ci ──────────┐
(ci.yml)     ├──► image ──► staging ──► production
sast ────────┘   (build,     (efêmero:   (aprovação manual
(CodeQL,          Trivy,      smoke +     no Environment,
 gitleaks)        GHCR)       DAST ZAP)   mesma imagem)
```

## Gatilhos

| Evento | Até onde vai |
|---|---|
| `push` na `main` | Pipeline completo, parando na aprovação de produção |
| `pull_request` para a `main` | Até o staging. Nada é publicado nem implantado (shift-left) |
| `workflow_dispatch` | Execução manual, igual ao push |

- **Concorrência:** um grupo por branch (`pipeline-<ref>`). Em PR, um push novo cancela o run anterior. Na `main`, o run novo espera na fila, porque um deploy não pode ser interrompido no meio.
- **Permissões:** o padrão é `contents: read`. Cada job pede só o que usa.

## Verificação estática × dinâmica

| Tipo | Ferramenta | Onde |
|---|---|---|
| Estática | Biome (lint/format), `tsc` (tipos), `pnpm audit` (dependências) | `ci.yml` |
| Estática | **CodeQL** `security-extended` (SAST) | job `sast` |
| Estática | **gitleaks** (credenciais em texto claro no histórico) | job `sast` |
| Estática | **Trivy** (CVEs na imagem Docker) | job `image` |
| Dinâmica | Vitest com Postgres efêmero, schema drift | `ci.yml` |
| Dinâmica | Health check + smoke HTTP contra o container rodando | job `staging` |
| Dinâmica | **OWASP ZAP baseline** (DAST) | job `staging` |

## Jobs

### 1. `ci`: integração contínua

Reaproveita o `ci.yml` do repositório como workflow reutilizável (`workflow_call`), sem duplicá-lo. Ele faz:

- lint e format (Biome) e guarda de tamanho de arquivo
- type check do monorepo
- testes com cobertura contra um Postgres efêmero
- schema drift: aplica as migrations num banco vazio e compara com o schema do Prisma
- auditoria de dependências (falha em `critical` e em `high` nova de runtime)
- build de todos os apps

Em PR ele não roda por aqui, porque o `ci.yml` já dispara sozinho, com os mesmos nomes de check.

### 2. `sast`: análise estática de segurança

```yaml
- uses: gitleaks/gitleaks-action@v2        # segredos no histórico (fetch-depth: 0)
- uses: github/codeql-action/init@v4       # languages: javascript-typescript
- uses: github/codeql-action/analyze@v4    # queries: security-extended
```

O CodeQL é gratuito só em repositório público. Em privado ele é pulado e o run mostra um aviso, em vez de virar um portão sempre vermelho.

### 3. `image`: artefato imutável

Só roda se `ci` e `sast` passaram.

1. **Build** multi-stage do `apps/app/Dockerfile` (deps → builder → runner), com cache do GitHub Actions.
2. **Tag pelo SHA do commit:** `ghcr.io/pavincius/cosmos-app:sha-7f3b8a1`.
3. **Trivy:** falha se houver CVE `CRITICAL` com correção disponível. Também gera um relatório SARIF (`CRITICAL,HIGH`) para a aba Security.
4. **Exporta a imagem** como artefato do run, para o staging usar exatamente esse binário.
5. **Publica no GHCR**, exceto em PR.

### 4. `staging`: primeiro ambiente

`environment: staging`, sem proteção.

Ambiente efêmero, análogo à produção, criado no próprio runner:

1. Sobe um **Postgres (pgvector)** como service container.
2. Aplica as **migrations** (`pnpm migrate`).
3. Carrega **a mesma imagem** do job anterior (`docker load`, sem rebuild).
4. Sobe o container com segredos **gerados por run** (`openssl rand`).
5. **Health check:** `/api/health` precisa responder 200 com o banco.
6. **Smoke tests** (`.github/scripts/smoke.sh`):
   - `/api/health` → 200
   - `/sign-in` → 200
   - `/cosmos` sem sessão → redireciona ou nega (3xx/401/403)
   - `/api/platform/health` sem sessão → redireciona ou nega
   - headers de segurança presentes: `x-content-type-options`, `x-frame-options`, `referrer-policy`
7. **OWASP ZAP baseline** (DAST) contra a aplicação rodando. O relatório sai como artefato.
8. Os logs do container são guardados como artefato.

### 5. `production`: segundo ambiente

`environment: production`, com **Required reviewers**.

- Só roda em `main` e fora de PR, depois do staging verde.
- **Espera aprovação manual**: é Continuous Delivery, não Continuous Deployment.
- **Promove sem reconstruir:** `docker buildx imagetools create` copia a tag `sha-xxxxxxx` para `:production`. O digest em produção é, bit a bit, o que passou no staging.
- Dispara o deploy via `PRODUCTION_DEPLOY_HOOK` quando esse secret existe.
- Escreve um resumo no run (imagem, commit e aprovação).

## Boas práticas da aula aplicadas

| Prática | Como aparece |
|---|---|
| Separar CI de CD | `ci`/`sast` → `image` → `staging` → `production`, encadeados por `needs:` |
| Condicionais | `if:` impede deploy em PR e limita produção à `main` |
| Environments com proteção | `staging` livre, `production` com revisor obrigatório |
| Secrets fora do código | `${{ secrets.* }}`; o staging gera segredos descartáveis por run |
| Cache | cache do pnpm (`setup-node`) e cache de camadas Docker (`type=gha`) |
| Versões travadas | `@v4`, `@v6`, `@v0.36.0` (nunca `@latest`/`@master`) |
| Artefato imutável | uma imagem por commit, promovida entre ambientes sem rebuild |
| Não compilar em produção | a imagem sai pronta; migrations rodam no pipeline, não no container |
| Health check | `HEALTHCHECK` no Dockerfile + `/api/health` verificado no staging |
| Shift-left | em PR a imagem é construída, escaneada e atacada antes do merge |

## Configuração necessária

- **Settings → Environments:** criar `staging` (sem regras) e `production` (Required reviewers).
- **Opcional:** secret `PRODUCTION_DEPLOY_HOOK` e variáveis `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_WEB_URL`.

## Limitações conhecidas

- A produção real do Cosmos hoje é a **Vercel**, que builda a partir do Git. O pipeline valida e promove a imagem Docker, mas a Vercel não executa essa imagem. O deploy hook dispara um build da Vercel, não a imagem promovida.
- As variáveis `NEXT_PUBLIC_*` são embutidas no bundle na hora do build. Isso é uma exceção inerente ao Next.js à regra do "mesmo artefato com configuração diferente por ambiente".
- O ZAP ainda está em modo relatório (`fail_action: false`) até a primeira triagem dos alertas.
