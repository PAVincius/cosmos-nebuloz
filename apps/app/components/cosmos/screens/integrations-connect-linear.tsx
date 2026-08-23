"use client";

import { Avatar, Button } from "@repo/design-system/cosmos/kit";
// integrations-connect-linear.tsx — ConnectLinearModal, separado de
// integrations.tsx pelo file-size-guard (teto de 800 linhas, scripts/
// file-size-guard.mts). Conteúdo movido como estava; ver o comentário acima
// do componente para o porquê da ordem "validar antes de gravar".
import { type CSSProperties, useEffect, useState } from "react";
import {
  analyzeLinearImport,
  connectLinearIntegration,
  discoverLinearTeams,
  type ImportCounts,
  type LinearImportPreview,
  type LinearTeamOption,
} from "@/app/(cosmos)/actions/integrations";
import { type KanbanEpic, listEpics } from "@/app/(cosmos)/actions/kanban";
import { ModalCard, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";
import type { CatalogEntry } from "./integrations";

const inputStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
  padding: "10px 12px",
  width: "100%",
};

const labelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  marginBottom: 6,
  textTransform: "uppercase",
};

// Conectar o Linear em dois passos, na ordem em que a segurança exige:
// validar a chave e listar os times **antes** de gravar qualquer coisa. O
// caminho inverso — gravar e testar depois — deixaria uma Integration ACTIVE
// apontando para credencial que não autentica, e alguém confiaria no card
// verde.
export function ConnectLinearModal({
  catalog,
  onConnected,
}: {
  catalog: CatalogEntry;
  onConnected: () => void;
}) {
  const { close } = useModal();
  const [name, setName] = useState(catalog.label);
  // Uma conexão por time do Linear significa vários registros com a mesma
  // fonte. Sem isto todos nasceriam chamados "Linear" e a tela viraria cinco
  // cards idênticos. O nome só é sugerido enquanto ninguém o digitou.
  const [nameTouched, setNameTouched] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [teams, setTeams] = useState<LinearTeamOption[] | null>(null);
  const [teamId, setTeamId] = useState("");
  // Project do Linear (COS-85/COS-91): no plano free os produtos moram como
  // projects dentro de um time só, e um ART de produto conecta num project —
  // não no time inteiro. Vazio = time inteiro. `discoverLinearTeams` já
  // devolve os projects aninhados em cada time (ver o comentário no
  // conector, `connectors/linear.ts`), então trocar de time é um lookup
  // local em `teams` — nunca um segundo fetch reagindo a `teamId`. É essa
  // ausência de um "enquanto isso" que fecha a corrida: não existe janela em
  // que o select possa mostrar projects de um time que não é mais o
  // selecionado.
  const [projectId, setProjectId] = useState("");
  const [importNow, setImportNow] = useState(true);
  // Prévia da hierarquia (etapa 2): quantas issues viram Feature e quantas
  // viram Story. Carrega sob demanda porque pagina o time inteiro no Linear.
  const [preview, setPreview] = useState<LinearImportPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  // O Cosmos é épico-cêntrico: feature sem épico não aparece em tela nenhuma.
  // A lista carrega junto com a validação da chave para o select já estar
  // pronto quando o passo do time aparecer.
  const [epics, setEpics] = useState<KanbanEpic[] | null>(null);
  const [epicId, setEpicId] = useState("");
  const [busy, setBusy] = useState(false);

  const discover = async () => {
    if (apiKey.trim().length < 8 || busy) {
      return;
    }
    setBusy(true);
    listEpics().then((r) => {
      if (r.ok) {
        setEpics(r.data);
      }
    });
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => discoverLinearTeams({ apiKey }), {
      loading: "Validando credencial no Linear...",
      success: (data: { account: string | null }) =>
        data.account
          ? `Autenticado como ${data.account}.`
          : "Credencial aceita.",
      error: (e: string) => `Linear recusou a credencial: ${e}`,
    });
    setBusy(false);
    if (res.ok) {
      setAccount(res.data.account);
      setTeams(res.data.teams);
      const primeiro = res.data.teams[0];
      setTeamId(primeiro?.id ?? "");
      if (!nameTouched && primeiro) {
        setName(`${catalog.label} · ${primeiro.name}`);
      }
    }
  };

  const escolherTime = (id: string) => {
    setTeamId(id);
    // Projects pertencem ao time anterior — mantê-los selecionados mandaria
    // um linearProjectId de outro time junto do submit.
    setProjectId("");
    setPreview(null);
    const escolhido = teams?.find((t) => t.id === id);
    if (!nameTouched && escolhido) {
      setName(`${catalog.label} · ${escolhido.name}`);
    }
  };

  const analisar = async () => {
    if (!(apiKey && teamId) || previewBusy) {
      return;
    }
    setPreviewBusy(true);
    const res = await analyzeLinearImport({
      apiKey,
      linearTeamId: teamId,
      ...(projectId ? { linearProjectId: projectId } : {}),
    });
    setPreviewBusy(false);
    // Falha em analisar não bloqueia conectar — a prévia é informativa.
    setPreview(res.ok ? res.data : null);
  };

  // Reanalisa quando muda o recorte (time/project) ou quando o import é
  // religado. A prévia só faz sentido depois da chave validada — teamId só
  // existe nesse ponto.
  // biome-ignore lint/correctness/useExhaustiveDependencies: analisar é estável o suficiente para o recorte
  useEffect(() => {
    if (!(teamId && importNow)) {
      return;
    }
    analisar();
  }, [teamId, projectId, importNow]);

  const escolherProject = (id: string) => {
    setProjectId(id);
    setPreview(null);
    const time = teams?.find((t) => t.id === teamId);
    const proj = time?.projects.find((p) => p.id === id);
    if (!nameTouched) {
      setName(
        proj
          ? `${catalog.label} · ${proj.name}`
          : time
            ? `${catalog.label} · ${time.name}`
            : name
      );
    }
  };

  const connect = async () => {
    if (!(teamId && name.trim()) || busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        connectLinearIntegration({
          name: name.trim(),
          apiKey,
          linearTeamId: teamId,
          importNow,
          ...(epicId ? { epicId } : {}),
          ...(projectId ? { linearProjectId: projectId } : {}),
        }),
      {
        loading: importNow
          ? "Conectando e importando issues..."
          : "Conectando...",
        success: (data: { imported: ImportCounts | null }) =>
          data.imported
            ? `Conectado — ${data.imported.created} criadas, ${data.imported.updated} atualizadas, ${data.imported.skipped} puladas.`
            : "Conectado. Sincronize quando quiser trazer as issues.",
        error: (e: string) => `Não foi possível conectar: ${e}`,
      }
    );
    setBusy(false);
    // Só fecha no sucesso: fechar no erro custaria a chave já digitada, e ela
    // não é lida de volta em lugar nenhum para repopular o campo.
    if (res.ok) {
      setApiKey("");
      close();
      onConnected();
    }
  };

  // Projects do time atualmente selecionado — lookup síncrono, não estado
  // próprio. Não há como este array apontar para o time errado, porque não
  // existe um "enquanto isso" em que ele possa ficar desatualizado.
  const projectsDoTime = teams?.find((t) => t.id === teamId)?.projects ?? [];

  return (
    <ModalCard
      icon={<Avatar name={catalog.label} size={24} tone={catalog.tone} />}
      subtitle={catalog.category}
      title={`Conectar ${catalog.label}`}
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="linear-name" style={labelStyle}>
            Nome da integração
          </label>
          <input
            id="linear-name"
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            placeholder="Ex: Linear · Meridian"
            style={inputStyle}
            value={name}
          />
        </div>

        <div>
          <label htmlFor="linear-key" style={labelStyle}>
            Personal API key
          </label>
          <input
            autoComplete="off"
            disabled={teams !== null}
            id="linear-key"
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && teams === null) {
                discover();
              }
            }}
            placeholder="lin_api_..."
            spellCheck={false}
            style={inputStyle}
            type="password"
            value={apiKey}
          />
          <p
            style={{
              color: "var(--ink-faint)",
              fontSize: 12,
              lineHeight: 1.5,
              margin: "6px 0 0",
            }}
          >
            Linear → Settings → Security &amp; access → Personal API keys. A
            chave é cifrada no servidor (AES-256-GCM) e nunca volta para esta
            tela — para trocá-la, reconecte.
          </p>
        </div>

        {teams !== null && (
          <div>
            <label htmlFor="linear-team" style={labelStyle}>
              Time do Linear{account ? ` · conta ${account}` : ""}
            </label>
            {teams.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: 13, margin: 0 }}>
                Esta conta não tem nenhum time visível. Nada a mapear.
              </p>
            ) : (
              <select
                id="linear-team"
                onChange={(e) => escolherTime(e.target.value)}
                style={inputStyle}
                value={teamId}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {`${t.key} · ${t.name}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {teams !== null && projectsDoTime.length > 0 && (
          <div>
            <label htmlFor="linear-project" style={labelStyle}>
              Project do Linear
            </label>
            <select
              id="linear-project"
              onChange={(e) => escolherProject(e.target.value)}
              style={inputStyle}
              value={projectId}
            >
              <option value="">— time inteiro —</option>
              {projectsDoTime.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p
              style={{
                color: "var(--ink-faint)",
                fontSize: 12,
                lineHeight: 1.5,
                margin: "6px 0 0",
              }}
            >
              No plano free os produtos vivem como projects de um time só.
              Escolher um project importa e sincroniza apenas as issues dele — é
              assim que cada ART de produto conecta sem engolir o time inteiro.
            </p>
          </div>
        )}

        {teams !== null && teams.length > 0 && (
          <div>
            <label htmlFor="linear-epic" style={labelStyle}>
              Épico de destino das features
            </label>
            <select
              id="linear-epic"
              onChange={(e) => setEpicId(e.target.value)}
              style={inputStyle}
              value={epicId}
            >
              <option value="">— sem épico (não aparece nos boards) —</option>
              {(epics ?? []).map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.title}
                </option>
              ))}
            </select>
            <p
              style={{
                color: "var(--ink-faint)",
                fontSize: 12,
                lineHeight: 1.5,
                margin: "6px 0 0",
              }}
            >
              As issues viram Features deste épico — é por ele que elas chegam
              ao Kanban de Épicos e ao Program Board. Sem épico, ficam só no
              banco. Crie um em Kanban → Novo Épico se ainda não houver.
            </p>
          </div>
        )}

        {teams !== null && teams.length > 0 && (
          <label
            htmlFor="linear-import"
            style={{
              alignItems: "center",
              color: "var(--ink-subtle)",
              display: "flex",
              fontSize: 13,
              gap: 8,
            }}
          >
            <input
              checked={importNow}
              id="linear-import"
              onChange={(e) => {
                setImportNow(e.target.checked);
                if (e.target.checked) {
                  analisar();
                } else {
                  setPreview(null);
                }
              }}
              type="checkbox"
            />
            Importar as issues agora
          </label>
        )}

        {teams !== null && importNow && (
          <div
            style={{
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "10px 12px",
            }}
          >
            <p
              style={{
                color: "var(--ink-subtle)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: 0.4,
                margin: "0 0 6px",
                textTransform: "uppercase",
              }}
            >
              Como esta estrutura vai entrar
            </p>
            {previewBusy || preview === null ? (
              <p
                style={{
                  color: "var(--ink-faint)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {previewBusy
                  ? "Lendo a hierarquia das issues..."
                  : "Analisando ao conectar. Issues com sub-issues viram Features; o resto vira Story."}
              </p>
            ) : (
              <ul
                style={{
                  color: "var(--ink-subtle)",
                  fontSize: 12,
                  lineHeight: 1.7,
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                <li>
                  <strong>{preview.features}</strong> com sub-issues → Feature
                </li>
                <li>
                  <strong>{preview.comSub}</strong> sub-issues → Story dentro da
                  Feature do parent
                </li>
                <li>
                  <strong>{preview.soltas}</strong> sem hierarquia → Story sem
                  feature
                </li>
              </ul>
            )}
            <p
              style={{
                color: "var(--ink-faint)",
                fontSize: 11,
                lineHeight: 1.5,
                margin: "8px 0 0",
              }}
            >
              No SAFe, Feature é o agregado e Story é o item de trabalho. Quem
              quiser controlar o recorte organiza a hierarquia no Linear antes
              de conectar.
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          {teams === null ? (
            <Button onClick={discover} size="sm" variant="primary">
              Validar e listar times
            </Button>
          ) : (
            <Button onClick={connect} size="sm" variant="primary">
              Conectar
            </Button>
          )}
        </div>
      </div>
    </ModalCard>
  );
}
