# Settings do Cosmos — as quatro lacunas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar as quatro funções que só existem nas telas antigas de `/settings/*` — relatórios agendados, integrações, papéis customizados e SSO — dentro do `/cosmos/settings`, para que exista uma porta só.

**Architecture:** Duas abas nascem (`Relatórios`, `Integrações`); duas lacunas viram seção de aba existente (`Papéis` em Membros, `SSO` em Segurança), porque é onde o assunto já mora. Nove abas ao fim, não onze. Cada tela nova é reescrita no kit do Cosmos consumindo as mesmas server actions que as telas antigas já usam — nenhuma action nova, nenhuma migration.

**Tech Stack:** Next.js 16 App Router · React 19 · Vitest + Testing Library · server actions com `Result<T>`

**Spec:** `docs/superpowers/specs/2026-08-07-cosmos-settings-paridade-design.md` (seções 3, 4, 7 e 8)

**Pré-requisito:** o dispatcher de relatório (PR #71) precisa estar na `main`. A aba Relatórios mostra histórico de execução, e sem o dispatcher esse histórico é sempre vazio.

## Global Constraints

- **Papel customizado amplia, nunca restringe.** `withSecureAction` só consulta `getCustomPermissions` depois de `hasPermission` ter negado. A UI não pode sugerir subtração: sem checkbox "remover permissão", sem estado "negado", sem texto que implique revogação.
- **Certificado e metadata de SSO são write-only.** Gravam e nunca voltam para a tela. `getSSOConfig` alimenta só status e `updatedAt`; os campos sensíveis renderizam vazios com rótulo "configurado em <data>". Substituir exige digitar de novo.
- **Segredo de integração nunca entra em `select`** (`secretHash`, `secretEnc`, `idp*`) — CN-02 do SRD. As abas mostram estado de conexão, não credencial.
- **Estado vazio honesto.** Quando uma action falha ou devolve vazio, a seção diz isso. Nunca renderiza zero, traço ou lista vazia sem explicação.
- Toda leitura e escrita escopada por `tenantId` no `where` — as actions já fazem; nenhuma tela pode contornar.
- Nenhum arquivo `"use server"` exporta valor (guard: `apps/app/__tests__/actions/use-server-exports.test.ts`).
- TypeScript estrito, sem `any` em código de aplicação.
- Commits em português, conventional commits, **sem** trailer de atribuição a IA.
- Testes de `apps/app`: `NODE_ENV=test ../../node_modules/.bin/vitest run <caminho>`. Não use `npx vitest` nem `pnpm --filter app test`.
- `pnpm exec biome` morre por OOM neste ambiente; a formatação é validada pelo CI. Siga o estilo do vizinho.
- `apps/app/components/cosmos/**` tem isenção de regras de a11y no `biome.jsonc` por ser port fiel do protótipo. **A isenção não é licença**: as seções novas são código nosso, não port — use `<button>` de verdade para linha clicável e `<fieldset>`/`<legend>` para grupo de filtro.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/app/components/cosmos/screens/settings.tsx` **(modificar)** | Registrar as duas abas novas em `TABS` e no `ADMIN_ONLY_TAB_IDS` |
| `apps/app/components/cosmos/screens/settings-reports-tab.tsx` **(criar)** | Aba Relatórios: lista, CRUD, histórico de execução |
| `apps/app/components/cosmos/screens/settings-integrations-tab.tsx` **(criar)** | Aba Integrações: conectores, billing, reuniões |
| `apps/app/components/cosmos/screens/settings-members-tab.tsx` **(modificar)** | Ganha a seção "Papéis customizados" |
| `apps/app/components/cosmos/screens/settings-security-tab.tsx` **(modificar)** | Ganha a seção "Provedor de identidade" |
| `apps/app/components/cosmos/screens/settings-shared.tsx` **(modificar)** | Helpers que passarem a ser usados por mais de uma aba |
| `apps/app/__tests__/screens/settings-*.test.tsx` **(criar, 4 arquivos)** | Um por lacuna |

**Sobre o tamanho dos arquivos:** `settings-members-tab.tsx` tem 336 linhas e `settings-security-tab.tsx` 278. As seções novas somam ~150 e ~130. Se qualquer um passar de ~500 linhas, extraia a seção nova para arquivo próprio (`settings-custom-roles-section.tsx`, `settings-sso-section.tsx`) e importe — a aba continua sendo o ponto de montagem. Prefira extrair a deixar crescer.

**Sobre o que este plano traz e o que não traz:** os testes vêm com código completo — são eles que travam o comportamento e as invariantes. O markup vem como contrato (seções, props, estados, componentes do kit a usar) e não como JSX transcrito: são ~1.300 linhas de UI, e transcrevê-las aqui produziria um documento que ninguém executa e que envelhece no primeiro ajuste de design. O implementador lê o kit nos arquivos vizinhos, que é a fonte viva do padrão.

---

## Task 1: Aba Relatórios

**Files:**
- Create: `apps/app/components/cosmos/screens/settings-reports-tab.tsx`
- Modify: `apps/app/components/cosmos/screens/settings.tsx`
- Test: `apps/app/__tests__/screens/settings-reports-tab.test.tsx`

**Interfaces:**
- Consumes: `listScheduledReports`, `createScheduledReport`, `updateScheduledReport`, `deleteScheduledReport`, `listReportExecutions` de `@/app/actions/reporting/scheduled-reports`
- Produces: `export default function SettingsReportsTab()` — sem props; carrega os próprios dados. Registrado em `settings.tsx` com `{ id: "reports", label: "Relatórios" }`.

Referência de comportamento: `apps/app/app/(authenticated)/settings/reports/reports-client.tsx` (190 linhas) — o que a tela antiga faz. Não copie o markup; copie o comportamento.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/screens/settings-reports-tab.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn();
const createMock = vi.fn();
const deleteMock = vi.fn();
const listExecutionsMock = vi.fn();

vi.mock("@/app/actions/reporting/scheduled-reports", () => ({
  listScheduledReports: (...a: unknown[]) => listMock(...a),
  createScheduledReport: (...a: unknown[]) => createMock(...a),
  updateScheduledReport: vi.fn(),
  deleteScheduledReport: (...a: unknown[]) => deleteMock(...a),
  listReportExecutions: (...a: unknown[]) => listExecutionsMock(...a),
}));

import SettingsReportsTab from "../../components/cosmos/screens/settings-reports-tab";

const RELATORIO = {
  id: "rpt_1",
  name: "Resumo semanal",
  type: "EXECUTIVE_SUMMARY",
  cronExpression: "0 8 * * 1",
  timezone: "America/Sao_Paulo",
  recipients: ["ana@cliente.com", "bruno@cliente.com"],
  enabled: true,
  lastRunAt: "2026-08-03T11:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue({ ok: true, data: { items: [RELATORIO] } });
  listExecutionsMock.mockResolvedValue({ ok: true, data: { items: [] } });
});

describe("SettingsReportsTab", () => {
  it("lista os relatórios com cadência e destinatários", async () => {
    render(<SettingsReportsTab />);

    expect(await screen.findByText("Resumo semanal")).toBeInTheDocument();
    expect(screen.getByText(/0 8 \* \* 1/)).toBeInTheDocument();
    expect(screen.getByText(/ana@cliente\.com/)).toBeInTheDocument();
  });

  it("diz que nunca rodou quando lastRunAt é null — não mostra traço mudo", async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: { items: [{ ...RELATORIO, lastRunAt: null }] },
    });

    render(<SettingsReportsTab />);

    expect(await screen.findByText(/nunca (rodou|executado)/i)).toBeInTheDocument();
  });

  it("mostra estado vazio honesto quando a action falha", async () => {
    listMock.mockResolvedValue({ ok: false, error: "INSUFFICIENT_ROLE" });

    render(<SettingsReportsTab />);

    // Não pode renderizar lista vazia em silêncio: precisa dizer que falhou.
    expect(
      await screen.findByText(/não foi possível carregar/i)
    ).toBeInTheDocument();
  });

  it("mostra estado vazio próprio quando não há relatório algum", async () => {
    listMock.mockResolvedValue({ ok: true, data: { items: [] } });

    render(<SettingsReportsTab />);

    expect(await screen.findByText(/nenhum relatório/i)).toBeInTheDocument();
    // E o vazio legítimo não pode se parecer com o de erro.
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument();
  });

  it("carrega o histórico de execuções do relatório selecionado", async () => {
    listExecutionsMock.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "exec_1",
            status: "DELIVERED",
            executedAt: "2026-08-03T11:00:05.000Z",
            error: null,
          },
        ],
      },
    });

    render(<SettingsReportsTab />);

    fireEvent.click(await screen.findByRole("button", { name: /resumo semanal/i }));

    await waitFor(() => {
      expect(listExecutionsMock).toHaveBeenCalledWith(
        expect.objectContaining({ reportId: "rpt_1" })
      );
    });
    expect(await screen.findByText(/DELIVERED|Entregue/i)).toBeInTheDocument();
  });

  it("mostra a mensagem de erro de uma execução FAILED", async () => {
    listExecutionsMock.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "exec_2",
            status: "FAILED",
            executedAt: "2026-08-03T11:00:05.000Z",
            error: "Falha ao entregar relatório: domain not verified",
          },
        ],
      },
    });

    render(<SettingsReportsTab />);
    fireEvent.click(await screen.findByRole("button", { name: /resumo semanal/i }));

    // Uma execução que falhou tem de dizer por quê — é o ponto do FAILED existir.
    expect(await screen.findByText(/domain not verified/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens/settings-reports-tab.test.tsx
```

Esperado: FAIL — `Failed to resolve import ".../settings-reports-tab"`.

- [ ] **Step 3: Implementar a aba**

Criar `apps/app/components/cosmos/screens/settings-reports-tab.tsx`.

Contrato:

| Elemento | Comportamento |
|---|---|
| Lista | Uma linha por `ScheduledReport`: nome, tipo, `cronExpression`, timezone, destinatários, badge de `enabled`, "última execução" |
| Linha | É um `<button>` de verdade — abre o histórico do relatório. Não use `<div onClick>`; a isenção de a11y do `biome.jsonc` é para o port, não para código novo |
| Histórico | Lista de `ScheduledReportExecution`: status, `executedAt`, e a mensagem de `error` quando `FAILED` |
| "Última execução" | `fmtDate(lastRunAt)` quando existe; **"Nunca rodou"** quando `null`. Nunca um traço |
| Vazio legítimo | "Nenhum relatório agendado" + o que fazer a respeito |
| Falha de carga | "Não foi possível carregar os relatórios" + o erro. Distinto do vazio legítimo |
| Criar/editar | Formulário com nome, tipo, `cronExpression`, timezone, destinatários, `enabled` |
| Apagar | Confirmação com o nome do relatório escrito por extenso |

Use do kit, seguindo os vizinhos (`settings-audit-tab.tsx` é a referência mais próxima em forma): `useAction` para carga, `useActionToast` para mutação, `Badge`, `EmptyState`, `fmtDate`, `fieldLabelStyle`, `inputStyle`, `selectStyle` de `./settings-shared`.

**Sobre `cadence`:** o modelo tem `cadence` (WEEKLY/MONTHLY/QUARTERLY) além de `cronExpression`, e a tela antiga escreve os dois em paralelo — duas fontes que podem discordar. O spec decide que `cronExpression` é a fonte de verdade (RD-03). A UI nova edita `cronExpression` e **deriva** `cadence` ao salvar (`* * * <dia-da-semana>` → WEEKLY; dia do mês → MONTHLY; a cada 3 meses → QUARTERLY; qualquer outra coisa → mantém o valor atual). Não exponha `cadence` como campo editável.

**Validação:** o PR #71 endureceu a validação de `cronExpression`/`timezone` na action via `previousFireTime`. A UI não precisa revalidar — precisa **mostrar** o erro que a action devolve, em português, junto ao campo.

- [ ] **Step 4: Registrar a aba**

Em `apps/app/components/cosmos/screens/settings.tsx`, acrescentar ao array `TABS`, depois de `billing`:

```tsx
  { id: "reports", label: "Relatórios" },
```

E o caso correspondente no corpo que resolve `active` para o componente, seguindo o padrão já usado pelas outras abas.

Decida o gate: relatório agendado dispara email para destinatários arbitrários, então a aba é de administração. Acrescente `"reports"` a `ADMIN_ONLY_TAB_IDS`.

- [ ] **Step 5: Rodar os testes**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens/settings-reports-tab.test.tsx
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens
```

Esperado: 6/6 no arquivo novo, e nenhuma regressão nos demais testes de tela.

- [ ] **Step 6: Commit**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
git add apps/app/components/cosmos/screens/settings-reports-tab.tsx apps/app/components/cosmos/screens/settings.tsx apps/app/__tests__/screens/settings-reports-tab.test.tsx
git commit -m "feat(settings): aba de relatórios agendados no Cosmos

Relatório agendado só existia em /settings/reports, fora do Cosmos.
A aba traz a lista, o CRUD e o histórico de execução — este último só
passou a ter conteúdo quando o dispatcher entrou.

Uma execução FAILED mostra a mensagem de erro. É o ponto de o estado
FAILED existir: antes, entrega que falhava ficava marcada como entregue.

\`cronExpression\` é a fonte de verdade do disparo, e \`cadence\` passa a
ser derivado ao salvar em vez de editado em paralelo — duas fontes que
podem discordar sem ninguém notar é o que havia antes."
```

---

## Task 2: Aba Integrações

**Files:**
- Create: `apps/app/components/cosmos/screens/settings-integrations-tab.tsx`
- Modify: `apps/app/components/cosmos/screens/settings.tsx`
- Test: `apps/app/__tests__/screens/settings-integrations-tab.test.tsx`

**Interfaces:**
- Consumes: `@/app/actions/billing` e `@/app/actions/meeting/integrations`
- Produces: `export default function SettingsIntegrationsTab()` — sem props. Registrado como `{ id: "integrations", label: "Integrações" }`.

Referências de comportamento (não de markup): `integrations-board.tsx` (369 linhas), `billing-connect-wizard.tsx` (234), `meeting-integrations-client.tsx` (183). É a maior das quatro lacunas.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/screens/settings-integrations-tab.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listIntegrationsMock = vi.fn();
const listMeetingMock = vi.fn();

vi.mock("@/app/actions/billing", () => ({
  listIntegrations: (...a: unknown[]) => listIntegrationsMock(...a),
  connectIntegration: vi.fn(),
  disconnectIntegration: vi.fn(),
}));

vi.mock("@/app/actions/meeting/integrations", () => ({
  listMeetingIntegrations: (...a: unknown[]) => listMeetingMock(...a),
  connectMeetingIntegration: vi.fn(),
  disconnectMeetingIntegration: vi.fn(),
}));

import SettingsIntegrationsTab from "../../components/cosmos/screens/settings-integrations-tab";

beforeEach(() => {
  vi.clearAllMocks();
  listIntegrationsMock.mockResolvedValue({
    ok: true,
    data: {
      items: [
        { id: "int_1", provider: "linear", status: "ACTIVE", lastSyncAt: "2026-08-07T10:00:00.000Z" },
        { id: "int_2", provider: "github", status: "ERROR", lastSyncAt: null },
      ],
    },
  });
  listMeetingMock.mockResolvedValue({ ok: true, data: { items: [] } });
});

describe("SettingsIntegrationsTab", () => {
  it("mostra o estado de cada conector", async () => {
    render(<SettingsIntegrationsTab />);

    expect(await screen.findByText(/linear/i)).toBeInTheDocument();
    expect(screen.getByText(/github/i)).toBeInTheDocument();
  });

  it("distingue conector com erro de conector ativo", async () => {
    render(<SettingsIntegrationsTab />);

    // O GitHub está em ERROR — a tela não pode apresentá-lo como se estivesse bem.
    const github = (await screen.findByText(/github/i)).closest("[data-provider]");
    expect(github).toHaveAttribute("data-status", "ERROR");
  });

  it("nunca renderiza campo de segredo", async () => {
    listIntegrationsMock.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "int_1",
            provider: "linear",
            status: "ACTIVE",
            lastSyncAt: null,
            // Se um dia a action passar a devolver isto, a tela não pode exibir.
            secretHash: "hash-que-nao-devia-existir",
            secretEnc: "cifra-que-nao-devia-existir",
          },
        ],
      },
    });

    const { container } = render(<SettingsIntegrationsTab />);
    await screen.findByText(/linear/i);

    expect(container.textContent).not.toContain("hash-que-nao-devia-existir");
    expect(container.textContent).not.toContain("cifra-que-nao-devia-existir");
  });

  it("mostra estado vazio honesto quando a carga falha", async () => {
    listIntegrationsMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<SettingsIntegrationsTab />);

    expect(
      await screen.findByText(/não foi possível carregar/i)
    ).toBeInTheDocument();
  });

  it("mostra as integrações de reunião na mesma aba", async () => {
    listMeetingMock.mockResolvedValue({
      ok: true,
      data: { items: [{ id: "mi_1", provider: "fireflies", status: "ACTIVE" }] },
    });

    render(<SettingsIntegrationsTab />);

    expect(await screen.findByText(/fireflies/i)).toBeInTheDocument();
  });
});
```

**Antes de escrever o teste**, confirme os nomes reais das actions e a forma do retorno:

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
grep -n "^export async function" apps/app/app/actions/billing/index.ts apps/app/app/actions/meeting/integrations.ts
```

Se os nomes divergirem do que está no teste acima, **use os reais** e ajuste os mocks — o teste é meu palpite sobre a API; o código é a verdade.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens/settings-integrations-tab.test.tsx
```

Esperado: FAIL por import não resolvido.

- [ ] **Step 3: Implementar a aba**

Criar `apps/app/components/cosmos/screens/settings-integrations-tab.tsx`, com três blocos:

| Bloco | Conteúdo |
|---|---|
| Conectores | Linear e GitHub: estado, último sync, conectar, desconectar |
| Billing | O fluxo do `billing-connect-wizard.tsx` |
| Reuniões | Fireflies e Fathom: estado, conectar, desconectar |

Cada card de conector carrega `data-provider` e `data-status` — é o que o teste usa para afirmar que erro não se parece com sucesso, e serve de gancho para E2E depois.

**Estado de conexão, nunca credencial.** A aba mostra: conectado/desconectado, último sync, erro do último sync. Não mostra token, hash, nem cifra — e não tem campo que os revele em placeholder ou title.

Desconectar é operação destrutiva: exija confirmação com o nome do provedor escrito por extenso.

Se o arquivo passar de ~500 linhas, quebre os três blocos em componentes irmãos (`settings-integrations-connectors.tsx`, `-billing.tsx`, `-meetings.tsx`) e deixe a aba como ponto de montagem.

- [ ] **Step 4: Registrar a aba**

Em `settings.tsx`, acrescentar `{ id: "integrations", label: "Integrações" }` ao `TABS` e o caso correspondente. Conectar e desconectar integração é administração — acrescente `"integrations"` a `ADMIN_ONLY_TAB_IDS`.

- [ ] **Step 5: Rodar os testes**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens
```

Esperado: 5/5 no arquivo novo, sem regressão.

- [ ] **Step 6: Commit**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
git add apps/app/components/cosmos/screens/settings-integrations-tab.tsx apps/app/components/cosmos/screens/settings.tsx apps/app/__tests__/screens/settings-integrations-tab.test.tsx
git commit -m "feat(settings): aba de integrações no Cosmos

Conectores, billing e integrações de reunião moravam em três rotas
separadas de /settings/integrations, fora do Cosmos. Passam a ser três
blocos de uma aba só.

Cada card leva data-provider e data-status: um conector em ERROR não
pode se parecer com um conector ativo, e o teste afirma isso.

A aba mostra estado de conexão, nunca credencial — segredo de integração
não entra em select (CN-02 do SRD), e há teste que falha se algum dia
vazar para a tela."
```

---

## Task 3: Seção Papéis customizados em Membros

**Files:**
- Modify: `apps/app/components/cosmos/screens/settings-members-tab.tsx` (336 linhas hoje)
- Test: `apps/app/__tests__/screens/settings-custom-roles.test.tsx`

**Interfaces:**
- Consumes: `listCustomRoles`, `createCustomRole`, `updateCustomRole`, `deleteCustomRole` de `@/app/actions/settings/custom-roles`; a lista de permissões de `@/app/actions/settings/permissions`
- Produces: seção dentro da aba Membros. Se o arquivo passar de ~500 linhas, extraia para `settings-custom-roles-section.tsx` e importe.

Referência de comportamento: `apps/app/app/(authenticated)/settings/roles/roles-client.tsx` (280 linhas).

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/screens/settings-custom-roles.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRolesMock = vi.fn();
const listPermissionsMock = vi.fn();

vi.mock("@/app/actions/settings/custom-roles", () => ({
  listCustomRoles: (...a: unknown[]) => listRolesMock(...a),
  createCustomRole: vi.fn(),
  updateCustomRole: vi.fn(),
  deleteCustomRole: vi.fn(),
}));

vi.mock("@/app/actions/settings/permissions", () => ({
  listPermissions: (...a: unknown[]) => listPermissionsMock(...a),
}));

import CustomRolesSection from "../../components/cosmos/screens/settings-custom-roles-section";

beforeEach(() => {
  vi.clearAllMocks();
  listRolesMock.mockResolvedValue({
    ok: true,
    data: {
      items: [
        { id: "cr_1", name: "Auditor", permissions: ["audit.read", "epic.read"] },
      ],
    },
  });
  listPermissionsMock.mockResolvedValue({
    ok: true,
    data: { items: ["audit.read", "epic.read", "epic.write"] },
  });
});

describe("CustomRolesSection", () => {
  it("lista os papéis com suas permissões", async () => {
    render(<CustomRolesSection canEdit />);

    expect(await screen.findByText("Auditor")).toBeInTheDocument();
    expect(screen.getByText(/audit\.read/)).toBeInTheDocument();
  });

  it("não oferece nenhum caminho para RESTRINGIR permissão", async () => {
    render(<CustomRolesSection canEdit />);
    await screen.findByText("Auditor");

    // A invariante: papel customizado amplia o que a matriz concede, nunca
    // subtrai. withSecureAction só consulta getCustomPermissions depois de
    // hasPermission ter negado — uma UI que sugere revogação mente sobre o
    // que o servidor faz.
    expect(screen.queryByText(/negar|remover permissão|revogar|restringir/i))
      .not.toBeInTheDocument();

    // Nenhum controle de tri-estado ou de exclusão de permissão.
    const checkboxes = screen.queryAllByRole("checkbox");
    for (const cb of checkboxes) {
      expect(cb).not.toHaveAttribute("aria-checked", "mixed");
    }
  });

  it("explica que papel customizado só adiciona", async () => {
    render(<CustomRolesSection canEdit />);

    // O texto não é decoração: sem ele, marcar caixas parece definir o
    // conjunto total de permissões, e não o acréscimo.
    expect(
      await screen.findByText(/amplia|adiciona|além d/i)
    ).toBeInTheDocument();
  });

  it("esconde as mutações de quem não pode editar", async () => {
    render(<CustomRolesSection canEdit={false} />);
    await screen.findByText("Auditor");

    expect(screen.queryByRole("button", { name: /novo papel|criar/i }))
      .not.toBeInTheDocument();
  });

  it("mostra estado vazio honesto quando a carga falha", async () => {
    listRolesMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<CustomRolesSection canEdit />);

    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});
```

Confirme antes o nome real da action de permissões:

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
grep -n "^export" apps/app/app/actions/settings/permissions.ts apps/app/app/actions/settings/custom-roles.ts
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens/settings-custom-roles.test.tsx
```

- [ ] **Step 3: Implementar a seção**

Criar `apps/app/components/cosmos/screens/settings-custom-roles-section.tsx` com `export default function CustomRolesSection({ canEdit }: { canEdit: boolean })`, e montá-la em `settings-members-tab.tsx` abaixo da lista de membros.

Contrato:

| Elemento | Comportamento |
|---|---|
| Lista | Um card por `CustomRole`: nome e as permissões concedidas |
| Texto de topo | Diz que papel customizado **amplia** o que o papel SAFe já concede. Obrigatório — sem ele a UI mente por omissão |
| Editor | Caixas de seleção para **adicionar** permissão. Nenhum tri-estado, nenhum "negar", nenhum "remover permissão" como conceito |
| Desmarcar | Significa "não acrescenta", nunca "revoga". O rótulo do grupo deve deixar isso explícito |
| Apagar papel | Confirmação com o nome por extenso |
| `canEdit` | Vem do `currentUserRole === "ADMIN"` que a aba já resolve. Sem ele, a seção é só leitura |

> **A invariante não é estética.** `withSecureAction` consulta `getCustomPermissions` **apenas** quando `hasPermission` já negou. Uma UI que oferece "negar" descreve um servidor que não existe: a permissão continuaria valendo pela matriz, e o admin acharia que revogou.

- [ ] **Step 4: Rodar os testes**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens
```

Esperado: 5/5 no arquivo novo, sem regressão em `settings-members`.

- [ ] **Step 5: Commit**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
git add apps/app/components/cosmos/screens/settings-custom-roles-section.tsx apps/app/components/cosmos/screens/settings-members-tab.tsx apps/app/__tests__/screens/settings-custom-roles.test.tsx
git commit -m "feat(settings): papéis customizados na aba Membros

Papel customizado só existia em /settings/roles. Entra como seção de
Membros, não como aba: a aba já resolve papel por usuário, e papel
customizado é a outra metade da mesma pergunta.

A UI só oferece adicionar permissão. Não há \"negar\", \"remover\" nem
tri-estado, e há teste que falha se aparecerem — withSecureAction
consulta getCustomPermissions apenas depois de hasPermission ter negado,
então papel customizado amplia e nunca subtrai. Uma tela que sugerisse
revogação descreveria um servidor que não existe."
```

---

## Task 4: Seção Provedor de identidade em Segurança

**Files:**
- Modify: `apps/app/components/cosmos/screens/settings-security-tab.tsx` (278 linhas hoje)
- Test: `apps/app/__tests__/screens/settings-sso.test.tsx`

**Interfaces:**
- Consumes: `getSSOConfig`, `saveSSOConfig` de `@/app/actions/settings/sso`
- Produces: seção dentro da aba Segurança. Extraia para `settings-sso-section.tsx` se o arquivo crescer demais.

Referência: `apps/app/app/(authenticated)/settings/sso/sso-config-form.tsx` (115 linhas).

**Esta é a única das quatro que não é migração de UI.** Hoje a aba Segurança diz "Configure o provedor de identidade antes de ativar o SSO — entity ID, ..." e **não oferece onde configurar**: quem segue a instrução não tem para onde ir. O formulário fecha esse beco.

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/app/__tests__/screens/settings-sso.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getConfigMock = vi.fn();
const saveConfigMock = vi.fn();

vi.mock("@/app/actions/settings/sso", () => ({
  getSSOConfig: (...a: unknown[]) => getConfigMock(...a),
  saveSSOConfig: (...a: unknown[]) => saveConfigMock(...a),
  toggleSsoEnabled: vi.fn(),
}));

import SsoSection from "../../components/cosmos/screens/settings-sso-section";

beforeEach(() => {
  vi.clearAllMocks();
  getConfigMock.mockResolvedValue({
    ok: true,
    data: {
      configured: true,
      enabled: false,
      updatedAt: "2026-08-01T10:00:00.000Z",
      entityId: "urn:exemplo:sp",
      ssoUrl: "https://idp.exemplo.com/sso",
    },
  });
});

describe("SsoSection", () => {
  it("oferece onde configurar o provedor — o beco que existia", async () => {
    render(<SsoSection canEdit />);

    expect(await screen.findByLabelText(/entity id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sso url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/certificado/i)).toBeInTheDocument();
  });

  it("NUNCA preenche certificado nem metadata, mesmo se a action devolver", async () => {
    getConfigMock.mockResolvedValue({
      ok: true,
      data: {
        configured: true,
        enabled: true,
        updatedAt: "2026-08-01T10:00:00.000Z",
        entityId: "urn:exemplo:sp",
        ssoUrl: "https://idp.exemplo.com/sso",
        // A action não devolve estes campos hoje. Se um dia devolver, a tela
        // continua não podendo exibi-los: credencial de federação não vira
        // ponto de leitura.
        certificate: "-----BEGIN CERTIFICATE-----SEGREDO",
        metadata: "<EntityDescriptor>SEGREDO</EntityDescriptor>",
      },
    });

    const { container } = render(<SsoSection canEdit />);
    await screen.findByLabelText(/entity id/i);

    const cert = screen.getByLabelText(/certificado/i) as HTMLInputElement;
    expect(cert.value).toBe("");
    expect(container.textContent).not.toContain("SEGREDO");
  });

  it("diz quando foi configurado, já que o valor não volta", async () => {
    render(<SsoSection canEdit />);

    // Sem isto, o campo vazio é ambíguo: nunca configurado, ou configurado e
    // não exibido? A data desfaz a ambiguidade.
    expect(await screen.findByText(/configurado em/i)).toBeInTheDocument();
  });

  it("é somente leitura para quem não é ADMIN", async () => {
    render(<SsoSection canEdit={false} />);
    await screen.findByText(/configurado em/i);

    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
  });

  it("mostra estado vazio honesto quando a carga falha", async () => {
    getConfigMock.mockResolvedValue({ ok: false, error: "boom" });

    render(<SsoSection canEdit />);

    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});
```

Confirme antes a forma real de `getSSOConfig`:

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
grep -n "^export async function\|select:" apps/app/app/actions/settings/sso.ts | head -20
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens/settings-sso.test.tsx
```

- [ ] **Step 3: Implementar a seção**

Criar `apps/app/components/cosmos/screens/settings-sso-section.tsx` com `export default function SsoSection({ canEdit }: { canEdit: boolean })`, montada em `settings-security-tab.tsx` **no lugar do texto que hoje instrui sem oferecer**.

Contrato:

| Campo | Comportamento |
|---|---|
| Entity ID | Lê e escreve normalmente |
| SSO URL | Lê e escreve normalmente |
| Certificado | **Write-only.** Renderiza vazio sempre. Rótulo auxiliar: "configurado em `<data>`" quando `configured` |
| Metadata | **Write-only**, mesma regra |
| Salvar | Só com `canEdit`. Enviar certificado vazio significa "manter o atual", não "apagar" — e o texto ao lado do campo tem de dizer isso |
| Interruptor de SSO | Continua onde está hoje, no card de status. A seção nova é o formulário, não o interruptor |

> **A restrição é do servidor também.** `getSSOConfig` não deve devolver `certificate` nem `metadata` em nenhum caminho. Se ao ler a action você descobrir que devolve, **pare e me avise** — é achado de segurança, não item de UI, e o teste do spec ("`getSSOConfig` não devolve cert nem metadata em nenhum caminho") pertence à action, não só à tela.

Só `ADMIN` salva, e `requireMfaForPrivilegedRoles` já cobre `ADMIN` no guard existente — não crie guard novo.

- [ ] **Step 4: Rodar os testes**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run __tests__/screens
```

Esperado: 5/5 no arquivo novo, sem regressão em `settings-security`.

- [ ] **Step 5: Commit**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz
git add apps/app/components/cosmos/screens/settings-sso-section.tsx apps/app/components/cosmos/screens/settings-security-tab.tsx apps/app/__tests__/screens/settings-sso.test.tsx
git commit -m "feat(settings): formulário de provedor de identidade em Segurança

A aba Segurança mandava configurar o provedor antes de ativar o SSO e
não oferecia onde: quem seguia a instrução não tinha para onde ir. O
formulário fecha o beco.

Certificado e metadata são write-only — gravam e nunca voltam para a
tela, que mostra apenas \"configurado em <data>\". Preserva a decisão
original de nunca renderizar credencial de federação, sem manter o beco.
Há teste que falha se um dia a action passar a devolvê-los e a tela os
exibir."
```

---

## Task 5: Verificação e a decisão sobre `/settings/*`

**Files:** nenhum de código — validação e uma decisão

- [ ] **Step 1: Rodar a suíte completa**

```bash
cd /Users/azos/Documents/Github/web-backoffice/my/cosmos-nebuloz/apps/app
NODE_ENV=test ../../node_modules/.bin/vitest run
pnpm typecheck
```

Esperado: nenhuma falha nova em relação à `main`, typecheck sem erro novo.

- [ ] **Step 2: Conferir a paridade, item a item**

Para cada função das telas antigas, confirme que existe equivalente no Cosmos:

| Tela antiga | Onde ficou |
|---|---|
| `/settings/reports` | Aba Relatórios |
| `/settings/integrations` | Aba Integrações, bloco Conectores + Billing |
| `/settings/integrations/meeting` | Aba Integrações, bloco Reuniões |
| `/settings/roles` | Membros → Papéis customizados |
| `/settings/sso` | Segurança → Provedor de identidade |

Qualquer função sem equivalente é bloqueio para o Step 3. Liste o que faltar em vez de seguir.

- [ ] **Step 3: PARE — a deleção é decisão do usuário**

O spec coloca a deleção de `/settings/*`, `/profile` e da sidebar legada como etapa 6, e diz que é irreversível. **Não a execute como parte deste plano.**

Apresente ao usuário: a tabela de paridade do Step 2, o resultado da suíte, e a pergunta de se deleta agora ou deixa as duas portas convivendo por um ciclo. Duas portas para o mesmo ajuste divergem, e a antiga é a que não recebe trabalho — mas apagar antes de a paridade estar confirmada em uso real troca um problema por outro.

Se o usuário mandar deletar, isso vira plano próprio: são 7 rotas, a sidebar legada, os prefixos de `packages/auth/proxy.ts`, os `revalidatePath` mortos e os E2E que ainda visitam essas rotas.

---

## Self-Review

**Cobertura do spec:**

| Item do spec | Task |
|---|---|
| §4.1 Papéis como seção de Membros | Task 3 |
| §4.1 invariante "amplia, nunca restringe" | Task 3, Step 1 (dois testes) + Step 3 |
| §4.2 SSO como seção de Segurança | Task 4 |
| §4.2 cert/metadata write-only | Task 4, Step 1 (teste) + Step 3 |
| §4.3 Integrações, três blocos | Task 2, Step 3 |
| §4.3 segredo nunca na tela | Task 2, Step 1 (teste) |
| §4.4 Relatórios: lista, CRUD, histórico | Task 1 |
| §3 nove abas | Tasks 1 e 2 registram duas; as outras duas são seção |
| §7 "estado vazio honesto quando a action falha" | Um teste por task (4 no total) |
| §8 ordem de entrega | Tasks 1→2→3→4, como o spec manda |
| §8 deleção por último | Task 5, Step 3 — e explicitamente fora deste plano |

**Não coberto, por decisão:** a deleção de `/settings/*` (Task 5 explica por quê) e a questão em aberto do retry de execução falha (§9 do spec), que o PR #71 deixou como `FAILED` sem reagendamento.

**Consistência:** `canEdit: boolean` é a prop das duas seções (Tasks 3 e 4), vindo do `currentUserRole === "ADMIN"` que as abas já resolvem. As duas abas novas (Tasks 1 e 2) não recebem props e carregam os próprios dados, como as abas existentes.

**Risco conhecido deste plano:** os testes das Tasks 2, 3 e 4 assumem nomes e formatos de retorno das actions que eu **não verifiquei um a um** — por isso cada uma dessas tasks começa com um comando `grep` para confirmar a API real, e a instrução explícita de que o código é a verdade e o teste é o palpite. Se a divergência for grande em alguma delas, o implementador deve avisar em vez de forçar o teste.
