"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createIntegration,
  discoverIntegrationProjects,
  runImportSnapshot,
  testIntegrationConnection,
} from "@/app/actions/integrations";
import type { IntegrationRow } from "@/app/actions/integrations/schema";

type WizardStep =
  | "source"
  | "credentials"
  | "test"
  | "project"
  | "mapping"
  | "import"
  | "done";

type Props = {
  mode: "connect" | "import";
  existingIntegration?: IntegrationRow;
  arts: { id: string; name: string }[];
  epics: { id: string; title: string }[];
  onClose: () => void;
};

export function ConnectWizard({
  mode,
  existingIntegration,
  arts,
  epics,
  onClose,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step state
  const [step, setStep] = useState<WizardStep>(
    mode === "import" ? "project" : "source"
  );

  // Form state
  const [source, setSource] = useState<string>(
    existingIntegration?.source ?? "linear"
  );
  const [name, setName] = useState(existingIntegration?.name ?? "");
  const [apiKey, setApiKey] = useState("");
  const [token, setToken] = useState("");
  const [org, setOrg] = useState("");

  // Discovery state
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testInfo, setTestInfo] = useState("");
  const [projects, setProjects] = useState<
    { id: string; name: string; key?: string }[]
  >([]);
  const [projectId, setProjectId] = useState("");

  // Mapping state
  const [epicId, setEpicId] = useState("");
  const [piPlanId, setPiPlanId] = useState("");
  const [targetType, setTargetType] = useState<"feature" | "story">("feature");

  // Result state
  const [integrationId, setIntegrationId] = useState(
    existingIntegration?.id ?? ""
  );
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<string, string> =
    source === "linear" ? { apiKey } : { token, org };

  // ── Step: Test connection ──────────────────────────────────────────────────

  function handleTest() {
    setErrorMsg("");
    startTransition(async () => {
      const result = await testIntegrationConnection({ source, name, config });
      if (result.ok) {
        setTestStatus("ok");
        setTestInfo(result.data.name ?? result.data.login ?? "Conectado");
        setStep("project");

        // Discover projects
        const disc = await discoverIntegrationProjects({
          source,
          name,
          config,
        });
        if (disc.ok) {
          setProjects(disc.data);
        } else {
          setErrorMsg(disc.error);
        }
      } else {
        setTestStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  // ── Step: Create integration + go to mapping ───────────────────────────────

  function handleSaveAndMap() {
    if (!projectId) {
      return;
    }
    startTransition(async () => {
      if (!integrationId) {
        const created = await createIntegration({
          source,
          name: name || `${source} integration`,
          config,
        });
        if (!created.ok) {
          setErrorMsg(created.error);
          return;
        }
        setIntegrationId(created.data.id);
      }
      setStep("mapping");
    });
  }

  // ── Step: Run import ───────────────────────────────────────────────────────

  function handleImport() {
    const id = integrationId || existingIntegration?.id;
    if (!(id && projectId)) {
      return;
    }
    startTransition(async () => {
      const result = await runImportSnapshot({
        integrationId: id,
        projectId,
        targetType,
        ...(epicId && { epicId }),
        ...(piPlanId && { piPlanId }),
      });
      if (result.ok) {
        setImportResult(result.data);
        setStep("done");
        router.refresh();
      } else {
        setErrorMsg(result.error);
      }
    });
  }

  const title =
    mode === "connect" ? "Conectar ferramenta" : "Importar snapshot";

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300/50 bg-red-500/5 px-4 py-2.5 text-red-700 text-sm">
            <XCircleIcon className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* ── SOURCE ── */}
        {step === "source" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ferramenta *</Label>
              <Select onValueChange={setSource} value={source}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">⬡ Linear</SelectItem>
                  <SelectItem value="github">⚙ GitHub Projects</SelectItem>
                  <SelectItem disabled value="asana">
                    ◈ Asana (em breve)
                  </SelectItem>
                  <SelectItem disabled value="gitlab">
                    ◆ GitLab (em breve)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome da integração *</Label>
              <Input
                onChange={(e) => setName(e.target.value)}
                placeholder={`Ex: ${source === "linear" ? "Linear — Time Produto" : "GitHub — cosmos-org"}`}
                value={name}
              />
            </div>
            <DialogFooter>
              <Button onClick={onClose} variant="outline">
                Cancelar
              </Button>
              <Button
                disabled={!name.trim()}
                onClick={() => setStep("credentials")}
              >
                Próximo
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── CREDENTIALS ── */}
        {step === "credentials" && (
          <div className="space-y-4">
            {source === "linear" ? (
              <div className="space-y-1.5">
                <Label>API Key do Linear *</Label>
                <Input
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="lin_api_..."
                  type="password"
                  value={apiKey}
                />
                <p className="text-muted-foreground text-xs">
                  Obtenha em{" "}
                  <a
                    className="inline-flex items-center gap-0.5 underline"
                    href="https://linear.app/settings/api"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    linear.app/settings/api{" "}
                    <ExternalLinkIcon className="h-2.5 w-2.5" />
                  </a>
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Personal Access Token (GitHub) *</Label>
                  <Input
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                    type="password"
                    value={token}
                  />
                  <p className="text-muted-foreground text-xs">
                    Precisa de escopo: <code>read:org, project, repo</code>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Organização ou usuário GitHub *</Label>
                  <Input
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="minha-org"
                    value={org}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button onClick={() => setStep("source")} variant="outline">
                Voltar
              </Button>
              <Button
                disabled={
                  isPending || (source === "linear" ? !apiKey : !(token && org))
                }
                onClick={handleTest}
              >
                {isPending ? (
                  <>
                    <LoaderIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                    Testando...
                  </>
                ) : (
                  "Testar conexão"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── TEST result + PROJECT selection ── */}
        {step === "project" && (
          <div className="space-y-4">
            {testStatus === "ok" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-300/50 bg-green-500/5 px-3 py-2 text-green-700 text-sm">
                <CheckCircle2Icon className="h-4 w-4 shrink-0" />
                Conectado como <strong>{testInfo}</strong>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {source === "linear" ? "Time no Linear *" : "Projeto GitHub *"}
              </Label>
              {projects.length === 0 && isPending ? (
                <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> Carregando
                  projetos...
                </div>
              ) : (
                <Select onValueChange={setProjectId} value={projectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.key ? `[${p.key}] ` : ""}
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => setStep("credentials")} variant="outline">
                Voltar
              </Button>
              <Button
                disabled={isPending || !projectId}
                onClick={handleSaveAndMap}
              >
                {isPending ? (
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Próximo"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── MAPPING ── */}
        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Configure para onde os itens importados serão mapeados no COSMOS.
            </p>

            <div className="space-y-1.5">
              <Label>Tipo de item COSMOS</Label>
              <Select
                onValueChange={(v) => setTargetType(v as "feature" | "story")}
                value={targetType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">
                    Feature (nível ART/PI)
                  </SelectItem>
                  <SelectItem value="story">
                    Story (nível Time/Sprint)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Epic de destino (opcional)</Label>
              <Select
                onValueChange={(v) => setEpicId(v === "none" ? "" : v)}
                value={epicId || "none"}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem épico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem épico —</SelectItem>
                  {epics.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-amber-300/40 bg-amber-500/5 px-3 py-2 text-amber-700 text-xs">
              Items importados mantêm link para o item original (externalUrl)
              para navegação rápida.
            </div>

            <DialogFooter>
              <Button onClick={() => setStep("project")} variant="outline">
                Voltar
              </Button>
              <Button disabled={isPending} onClick={handleImport}>
                {isPending ? (
                  <>
                    <LoaderIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                    Importando...
                  </>
                ) : (
                  "Importar agora"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2Icon className="h-10 w-10 text-green-500" />
              <p className="font-semibold text-base">Import concluído!</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-green-700">
                  +{importResult.created} criados
                </span>
                <span className="font-semibold text-blue-700">
                  ↻{importResult.updated} atualizados
                </span>
                <span className="text-muted-foreground">
                  ⊘{importResult.skipped} ignorados
                </span>
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                Os itens aparecem no WSJF, Program Board e Feature Boards com
                link para a ferramenta original.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
