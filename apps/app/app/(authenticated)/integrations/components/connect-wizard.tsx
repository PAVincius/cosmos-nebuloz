"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@repo/design-system/components/ui/select";
import { Badge } from "@repo/design-system/components/ui/badge";
import { CheckCircle2Icon, XCircleIcon, LoaderIcon, ExternalLinkIcon } from "lucide-react";
import {
  testIntegrationConnection,
  discoverIntegrationProjects,
  createIntegration,
  runImportSnapshot,
} from "@/app/actions/integrations";
import type { IntegrationRow } from "@/app/actions/integrations/schema";

type WizardStep = "source" | "credentials" | "test" | "project" | "mapping" | "import" | "done";

type Props = {
  mode:                "connect" | "import";
  existingIntegration?: IntegrationRow;
  arts:                { id: string; name: string }[];
  epics:               { id: string; title: string }[];
  onClose:             () => void;
};

export function ConnectWizard({ mode, existingIntegration, arts, epics, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step state
  const [step, setStep] = useState<WizardStep>(
    mode === "import" ? "project" : "source"
  );

  // Form state
  const [source, setSource] = useState<string>(existingIntegration?.source ?? "linear");
  const [name,   setName]   = useState(existingIntegration?.name ?? "");
  const [apiKey, setApiKey] = useState("");
  const [token,  setToken]  = useState("");
  const [org,    setOrg]    = useState("");

  // Discovery state
  const [testStatus, setTestStatus]   = useState<"idle" | "ok" | "error">("idle");
  const [testInfo,   setTestInfo]     = useState("");
  const [projects,   setProjects]     = useState<{ id: string; name: string; key?: string }[]>([]);
  const [projectId,  setProjectId]    = useState("");

  // Mapping state
  const [epicId,    setEpicId]    = useState("");
  const [piPlanId,  setPiPlanId]  = useState("");
  const [targetType, setTargetType] = useState<"feature" | "story">("feature");

  // Result state
  const [integrationId, setIntegrationId] = useState(existingIntegration?.id ?? "");
  const [importResult,  setImportResult]  = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [errorMsg,      setErrorMsg]      = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<string, string> = source === "linear"
    ? { apiKey }
    : { token, org };

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
        const disc = await discoverIntegrationProjects({ source, name, config });
        if (disc.ok) setProjects(disc.data);
        else setErrorMsg(disc.error);
      } else {
        setTestStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  // ── Step: Create integration + go to mapping ───────────────────────────────

  function handleSaveAndMap() {
    if (!projectId) return;
    startTransition(async () => {
      if (!integrationId) {
        const created = await createIntegration({ source, name: name || `${source} integration`, config });
        if (!created.ok) { setErrorMsg(created.error); return; }
        setIntegrationId(created.data.id);
      }
      setStep("mapping");
    });
  }

  // ── Step: Run import ───────────────────────────────────────────────────────

  function handleImport() {
    const id = integrationId || existingIntegration?.id;
    if (!id || !projectId) return;
    startTransition(async () => {
      const result = await runImportSnapshot({
        integrationId: id,
        projectId,
        targetType,
        ...(epicId   && { epicId }),
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

  const title = mode === "connect" ? "Conectar ferramenta" : "Importar snapshot";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Error message */}
        {errorMsg && (
          <div className="rounded-lg border border-red-300/50 bg-red-500/5 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
            <XCircleIcon className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* ── SOURCE ── */}
        {step === "source" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ferramenta *</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">⬡ Linear</SelectItem>
                  <SelectItem value="github">⚙ GitHub Projects</SelectItem>
                  <SelectItem value="asana" disabled>◈ Asana (em breve)</SelectItem>
                  <SelectItem value="gitlab" disabled>◆ GitLab (em breve)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome da integração *</Label>
              <Input
                placeholder={`Ex: ${source === "linear" ? "Linear — Time Produto" : "GitHub — cosmos-org"}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => setStep("credentials")} disabled={!name.trim()}>
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
                  type="password"
                  placeholder="lin_api_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Obtenha em{" "}
                  <a
                    href="https://linear.app/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-0.5"
                  >
                    linear.app/settings/api <ExternalLinkIcon className="h-2.5 w-2.5" />
                  </a>
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Personal Access Token (GitHub) *</Label>
                  <Input
                    type="password"
                    placeholder="ghp_..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Precisa de escopo: <code>read:org, project, repo</code>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Organização ou usuário GitHub *</Label>
                  <Input
                    placeholder="minha-org"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("source")}>Voltar</Button>
              <Button
                onClick={handleTest}
                disabled={isPending || (source === "linear" ? !apiKey : !token || !org)}
              >
                {isPending ? (
                  <><LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" /> Testando...</>
                ) : "Testar conexão"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── TEST result + PROJECT selection ── */}
        {step === "project" && (
          <div className="space-y-4">
            {testStatus === "ok" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-300/50 bg-green-500/5 px-3 py-2 text-sm text-green-700">
                <CheckCircle2Icon className="h-4 w-4 shrink-0" />
                Conectado como <strong>{testInfo}</strong>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {source === "linear" ? "Time no Linear *" : "Projeto GitHub *"}
              </Label>
              {projects.length === 0 && isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> Carregando projetos...
                </div>
              ) : (
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.key ? `[${p.key}] ` : ""}{p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("credentials")}>Voltar</Button>
              <Button onClick={handleSaveAndMap} disabled={isPending || !projectId}>
                {isPending ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : "Próximo"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── MAPPING ── */}
        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Configure para onde os itens importados serão mapeados no COSMOS.
            </p>

            <div className="space-y-1.5">
              <Label>Tipo de item COSMOS</Label>
              <Select value={targetType} onValueChange={(v) => setTargetType(v as "feature" | "story")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature (nível ART/PI)</SelectItem>
                  <SelectItem value="story">Story (nível Time/Sprint)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Epic de destino (opcional)</Label>
              <Select value={epicId || "none"} onValueChange={(v) => setEpicId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem épico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sem épico —</SelectItem>
                  {epics.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-amber-300/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
              Items importados mantêm link para o item original (externalUrl) para navegação rápida.
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("project")}>Voltar</Button>
              <Button onClick={handleImport} disabled={isPending}>
                {isPending ? (
                  <><LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" /> Importando...</>
                ) : "Importar agora"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2Icon className="h-10 w-10 text-green-500" />
              <p className="text-base font-semibold">Import concluído!</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-700 font-semibold">+{importResult.created} criados</span>
                <span className="text-blue-700 font-semibold">↻{importResult.updated} atualizados</span>
                <span className="text-muted-foreground">⊘{importResult.skipped} ignorados</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Os itens aparecem no WSJF, Program Board e Feature Boards com link para a ferramenta original.
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
