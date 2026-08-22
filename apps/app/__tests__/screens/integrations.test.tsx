// integrations.test.tsx — Integrações (/cosmos/integrations). Cobre os
// critérios da story-060 visíveis na tela: AC-001 (pausar/retomar o ciclo de
// vida do conector), AC-002 (testar conexão sem pedir credencial), AC-004
// (saúde de sincronização vinda de SyncLog, "nunca sincronizado" sem log) e
// AC-006 (vazio/erro sem conexão fabricada). Asserção sobre conteúdo — sem
// snapshot.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationView } from "../../app/(cosmos)/actions/integrations";

const listIntegrationsMock = vi.fn();
const setIntegrationPausedMock = vi.fn();
const testIntegrationConnectionMock = vi.fn();
const discoverLinearTeamsMock = vi.fn();
const discoverLinearProjectsMock = vi.fn();
const connectLinearIntegrationMock = vi.fn();
const resyncIntegrationMock = vi.fn();
const listEpicsMock = vi.fn();

// O modal importa listEpics de kanban.ts; sem o Next para trocar "use server"
// por stub RPC, importar o módulo real executa código de servidor no jsdom e
// explode no guard de variável de ambiente.
vi.mock("@/app/(cosmos)/actions/kanban", () => ({
  listEpics: (...args: unknown[]) => listEpicsMock(...args),
}));

vi.mock("@/app/(cosmos)/actions/integrations", () => ({
  listIntegrations: (...args: unknown[]) => listIntegrationsMock(...args),
  setIntegrationPaused: (...args: unknown[]) =>
    setIntegrationPausedMock(...args),
  testIntegrationConnection: (...args: unknown[]) =>
    testIntegrationConnectionMock(...args),
  discoverLinearTeams: (...args: unknown[]) => discoverLinearTeamsMock(...args),
  discoverLinearProjects: (...args: unknown[]) =>
    discoverLinearProjectsMock(...args),
  connectLinearIntegration: (...args: unknown[]) =>
    connectLinearIntegrationMock(...args),
  resyncIntegration: (...args: unknown[]) => resyncIntegrationMock(...args),
}));

import IntegrationsScreen from "../../components/cosmos/screens/integrations";

const integration = (over: Partial<IntegrationView>): IntegrationView => ({
  id: "i1",
  source: "github",
  name: "GitHub Corp",
  status: "ACTIVE",
  lastSyncAt: "2026-02-01T00:00:00.000Z",
  lastSync: null,
  ...over,
});

const ITEMS: IntegrationView[] = [integration({})];

describe("IntegrationsScreen", () => {
  beforeEach(() => {
    listIntegrationsMock.mockReset();
    setIntegrationPausedMock.mockReset();
    testIntegrationConnectionMock.mockReset();
    discoverLinearTeamsMock.mockReset();
    discoverLinearProjectsMock.mockReset();
    discoverLinearProjectsMock.mockResolvedValue({ ok: true, data: [] });
    listEpicsMock.mockReset();
    listEpicsMock.mockResolvedValue({ ok: true, data: [] });
    connectLinearIntegrationMock.mockReset();
    resyncIntegrationMock.mockReset();
  });

  it("renders a connected card with real status/sync and an available card for an unconfigured connector", async () => {
    listIntegrationsMock.mockResolvedValueOnce({ ok: true, data: ITEMS });
    render(<IntegrationsScreen />);

    // Real, configured connector.
    expect(await screen.findByText("GitHub Corp")).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.getByText(/Sincronizado em/)).toBeTruthy();
    expect(screen.getByText("Gerenciar")).toBeTruthy();

    // Catalog entry with zero configured rows for this tenant — honestly
    // "available", not faked as connected.
    expect(screen.getByText("Linear")).toBeTruthy();
    expect(screen.getAllByText("Conectar").length).toBeGreaterThan(0);
    expect(screen.queryByText("GitHub")).toBeNull(); // no duplicate "available" card for the already-connected source

    // Header meta splits real counts: the catalog has 9 entries; with
    // "github" configured, 8 remain "disponíveis".
    expect(screen.getByText("1 conectadas")).toBeTruthy();
    expect(screen.getByText("8 disponíveis")).toBeTruthy();
  });

  it("mostra a saúde da última sincronização vinda de SyncLog (AC-004)", async () => {
    listIntegrationsMock.mockResolvedValueOnce({
      ok: true,
      data: [
        integration({
          lastSync: {
            id: "l1",
            type: "snapshot",
            status: "partial",
            itemsCreated: 3,
            itemsUpdated: 2,
            itemsSkipped: 1,
            createdAt: "2026-02-01T00:00:00.000Z",
          },
        }),
      ],
    });

    render(<IntegrationsScreen />);

    // parcial é distinguido de sucesso: FR-020 diz que PARTIAL não faz
    // rollback, então é um estado real que o Admin precisa ver
    expect(
      await screen.findByText("Última sincronização: parcial")
    ).toBeTruthy();
    expect(
      screen.getByText("3 criados · 2 atualizados · 1 pulado")
    ).toBeTruthy();
  });

  it("diz que nunca sincronizou, sem contador zerado (AC-004)", async () => {
    listIntegrationsMock.mockResolvedValueOnce({
      ok: true,
      data: [integration({ lastSyncAt: null, lastSync: null })],
    });

    render(<IntegrationsScreen />);

    expect(await screen.findByText("Nunca sincronizado")).toBeTruthy();
    expect(screen.queryByText(/criados/)).toBeNull();
    expect(screen.queryByText(/Última sincronização:/)).toBeNull();
  });

  it("pausa o conector pela tela e recarrega a lista (AC-001)", async () => {
    listIntegrationsMock
      .mockResolvedValueOnce({ ok: true, data: ITEMS })
      .mockResolvedValueOnce({
        ok: true,
        data: [integration({ status: "PAUSED" })],
      });
    setIntegrationPausedMock.mockResolvedValue({
      ok: true,
      data: { id: "i1", status: "PAUSED" },
    });

    render(<IntegrationsScreen />);
    await screen.findByText("GitHub Corp");

    fireEvent.click(screen.getByRole("button", { name: "Pausar GitHub Corp" }));

    await waitFor(() =>
      expect(setIntegrationPausedMock).toHaveBeenCalledWith({
        id: "i1",
        paused: true,
      })
    );
    await waitFor(() => expect(listIntegrationsMock).toHaveBeenCalledTimes(2));
  });

  it("mostra o conector pausado e oferece retomar (AC-001)", async () => {
    listIntegrationsMock.mockResolvedValueOnce({
      ok: true,
      data: [integration({ status: "PAUSED" })],
    });

    render(<IntegrationsScreen />);

    expect(await screen.findByText("Pausado")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retomar GitHub Corp" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Pausar GitHub Corp" })
    ).toBeNull();
  });

  it("testa a conexão pela tela sem pedir credencial alguma (AC-002)", async () => {
    listIntegrationsMock.mockResolvedValue({ ok: true, data: ITEMS });
    testIntegrationConnectionMock.mockResolvedValue({
      ok: true,
      data: { id: "i1", status: "ACTIVE", account: "octocat" },
    });

    render(<IntegrationsScreen />);
    await screen.findByText("GitHub Corp");

    fireEvent.click(
      screen.getByRole("button", { name: "Testar conexão de GitHub Corp" })
    );

    await waitFor(() =>
      expect(testIntegrationConnectionMock).toHaveBeenCalledWith({ id: "i1" })
    );
    // nenhum campo de entrada existe nesta tela: credencial não é digitada aqui
    expect(document.querySelector("input")).toBeNull();
  });

  it("shows the non-secret manage view for a connected integration without leaking config/mapping", async () => {
    listIntegrationsMock.mockResolvedValueOnce({ ok: true, data: ITEMS });
    render(<IntegrationsScreen />);

    fireEvent.click(await screen.findByText("Gerenciar"));

    expect(await screen.findByText("Fonte")).toBeTruthy();
    expect(screen.getByText("github")).toBeTruthy();
    expect(screen.getByText(/Credenciais e mapeamento de campos/)).toBeTruthy();
    // No credential-shaped content anywhere in the modal.
    expect(screen.queryByText(/apiKey|token|mapping/i)).toBeNull();
  });

  it("shows an honest deferred message for a source with no connector in the repo", async () => {
    // No configured integrations at all here, so every catalog card is
    // "available" and any "Sincronizado em" text would only be able to come
    // from a fabrication, not real data.
    listIntegrationsMock.mockResolvedValueOnce({ ok: true, data: [] });
    render(<IntegrationsScreen />);

    expect(await screen.findByText("0 conectadas")).toBeTruthy();
    expect(screen.getByText("9 disponíveis")).toBeTruthy();

    // Jira é a segunda entrada do catálogo e não tem cliente de API nem rota
    // de ingestão no repositório — o modal diz isso em vez de coletar chave.
    fireEvent.click(screen.getAllByText("Conectar")[1]);

    expect(await screen.findByText(/Não há conector para Jira/)).toBeTruthy();
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(screen.queryByText("Conectado")).toBeNull();
    expect(screen.queryByText("Ativo")).toBeNull();
    expect(screen.queryByText(/Sincronizado em/)).toBeNull();
  });

  it("conecta o Linear validando a credencial antes de gravar, e só então oferece o time", async () => {
    listIntegrationsMock.mockResolvedValue({ ok: true, data: [] });
    discoverLinearTeamsMock.mockResolvedValue({
      ok: true,
      data: {
        account: "Nebuloz",
        teams: [{ id: "lt_1", name: "Meridian", key: "MER", projects: [] }],
      },
    });
    connectLinearIntegrationMock.mockResolvedValue({
      ok: true,
      data: { id: "i9", imported: { created: 4, updated: 0, skipped: 0 } },
    });

    render(<IntegrationsScreen />);
    fireEvent.click((await screen.findAllByText("Conectar"))[0]);

    // Antes de validar, nenhuma escolha de time é oferecida: escolher time de
    // uma conta que ainda não autenticou seria escolher sobre nada.
    expect(screen.queryByLabelText(/Time do Linear/)).toBeNull();

    const key = screen.getByLabelText("Personal API key");
    fireEvent.change(key, { target: { value: "lin_api_teste_00000000" } });
    fireEvent.click(screen.getByText("Validar e listar times"));

    await waitFor(() =>
      expect(discoverLinearTeamsMock).toHaveBeenCalledWith({
        apiKey: "lin_api_teste_00000000",
      })
    );

    expect(await screen.findByText("MER · Meridian")).toBeTruthy();
    // O modal é o último "Conectar" do documento — os anteriores são os cards
    // do catálogo, que continuam atrás dele.
    const submits = screen.getAllByText("Conectar");
    const submit = submits.at(-1);
    if (!submit) {
      throw new Error("botão de submit do modal não renderizou");
    }
    fireEvent.click(submit);

    await waitFor(() =>
      expect(connectLinearIntegrationMock).toHaveBeenCalledWith({
        name: "Linear · Meridian",
        apiKey: "lin_api_teste_00000000",
        linearTeamId: "lt_1",
        importNow: true,
      })
    );
  });

  it("deixa conectar um segundo time do Linear a partir de um card já conectado", async () => {
    // O catálogo esconde a fonte quando já existe integração dela. Com uma
    // conexão por time do Linear, sem esta porta o segundo time não teria por
    // onde entrar.
    listIntegrationsMock.mockResolvedValue({
      ok: true,
      data: [
        integration({ id: "i2", source: "linear", name: "Linear · Meridian" }),
      ],
    });
    discoverLinearTeamsMock.mockResolvedValue({
      ok: true,
      data: {
        account: "Nebuloz",
        teams: [{ id: "lt_2", name: "Charter", key: "CHA", projects: [] }],
      },
    });

    render(<IntegrationsScreen />);
    await screen.findByText("Linear · Meridian");

    // Card de catálogo do Linear não existe mais — só o do conectado. Os
    // outros conectores do catálogo seguem com o botão "Conectar" deles.
    expect(screen.queryByText("Linear")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Conectar outro time do Linear" })
    );

    const key = await screen.findByLabelText("Personal API key");
    fireEvent.change(key, { target: { value: "lin_api_teste_00000000" } });
    fireEvent.click(screen.getByText("Validar e listar times"));

    // O nome sugerido acompanha o time, senão nasceriam cinco "Linear".
    expect(await screen.findByDisplayValue("Linear · Charter")).toBeTruthy();
  });

  it("carrega os projects do time escolhido dentro do modal, sem quebrar se o fetch atrasar (COS-91)", async () => {
    // Regra da corrida de modal (PR #80): a lista de projects precisa vir de
    // um fetch disparado DENTRO do modal (aqui, reativo à troca de teamId),
    // nunca de uma prop congelada em modal.open. Atrasamos a resolução de
    // propósito para provar que o formulário — inclusive o próprio select de
    // project — não quebra nem trava enquanto ela ainda não chegou.
    listIntegrationsMock.mockResolvedValue({ ok: true, data: [] });
    discoverLinearTeamsMock.mockResolvedValue({
      ok: true,
      data: {
        account: "Nebuloz",
        teams: [{ id: "lt_1", name: "Meridian", key: "MER" }],
      },
    });
    let resolveProjects: (v: {
      ok: true;
      data: { id: string; name: string }[];
    }) => void = () => {};
    discoverLinearProjectsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProjects = resolve;
        })
    );
    connectLinearIntegrationMock.mockResolvedValue({
      ok: true,
      data: { id: "i9", imported: null },
    });

    render(<IntegrationsScreen />);
    fireEvent.click((await screen.findAllByText("Conectar"))[0]);

    const key = screen.getByLabelText("Personal API key");
    fireEvent.change(key, { target: { value: "lin_api_teste_00000000" } });
    fireEvent.click(screen.getByText("Validar e listar times"));

    await waitFor(() =>
      expect(discoverLinearProjectsMock).toHaveBeenCalledWith({
        apiKey: "lin_api_teste_00000000",
        linearTeamId: "lt_1",
      })
    );

    // O time já foi escolhido e o select de project existe, só sem opções
    // além da default — nada trava enquanto o fetch não resolveu.
    expect(screen.getByLabelText(/Project do Linear/)).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Charter" })).toBeNull();

    resolveProjects({
      ok: true,
      data: [
        { id: "proj_1", name: "Charter" },
        { id: "proj_2", name: "Meridian" },
      ],
    });

    fireEvent.change(await screen.findByLabelText(/Project do Linear/), {
      target: { value: "proj_1" },
    });

    const submits = screen.getAllByText("Conectar");
    const submit = submits.at(-1);
    if (!submit) {
      throw new Error("botão de submit do modal não renderizou");
    }
    fireEvent.click(submit);

    await waitFor(() =>
      expect(connectLinearIntegrationMock).toHaveBeenCalledWith({
        name: "Linear · Meridian",
        apiKey: "lin_api_teste_00000000",
        linearTeamId: "lt_1",
        importNow: true,
        linearProjectId: "proj_1",
      })
    );
  });

  it("mostra que a lista de projects falhou sem travar a conexão, e conecta sem filtro (degradação honesta)", async () => {
    listIntegrationsMock.mockResolvedValue({ ok: true, data: [] });
    discoverLinearTeamsMock.mockResolvedValue({
      ok: true,
      data: {
        account: "Nebuloz",
        teams: [{ id: "lt_1", name: "Meridian", key: "MER" }],
      },
    });
    discoverLinearProjectsMock.mockResolvedValue({
      ok: false,
      error: "Linear API 500: boom",
    });
    connectLinearIntegrationMock.mockResolvedValue({
      ok: true,
      data: { id: "i9", imported: null },
    });

    render(<IntegrationsScreen />);
    fireEvent.click((await screen.findAllByText("Conectar"))[0]);

    const key = screen.getByLabelText("Personal API key");
    fireEvent.change(key, { target: { value: "lin_api_teste_00000000" } });
    fireEvent.click(screen.getByText("Validar e listar times"));

    expect(
      await screen.findByText(/Não foi possível carregar os projects/)
    ).toBeTruthy();

    // Submit sem seleção continua conectando, igual ao comportamento atual —
    // a falha de fetch não é bloqueante, e o payload não ganha linearProjectId.
    const submits = screen.getAllByText("Conectar");
    const submit = submits.at(-1);
    if (!submit) {
      throw new Error("botão de submit do modal não renderizou");
    }
    fireEvent.click(submit);

    await waitFor(() =>
      expect(connectLinearIntegrationMock).toHaveBeenCalledWith({
        name: "Linear · Meridian",
        apiKey: "lin_api_teste_00000000",
        linearTeamId: "lt_1",
        importNow: true,
      })
    );
  });

  it("shows the error state when the action fails", async () => {
    listIntegrationsMock.mockResolvedValueOnce({ ok: false, error: "boom" });
    render(<IntegrationsScreen />);

    expect(
      await screen.findByText("Não foi possível carregar os dados.")
    ).toBeTruthy();
  });
});
