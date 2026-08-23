"use client";

// PolicyDraftPreview — prévia inline de rascunho gerado por IA (FR-2.7).
//
// Gerar ≠ salvar: "Gerar rascunho" chama generatePolicyDraft (só audita, não
// persiste); só "Aceitar rascunho" grava, via saveGeneratedDraft já
// existente — o mesmo fluxo que o rascunho manual usa. Substitui o modal
// fake de geração (setTimeout) que existia antes nesta tela.
import { Button } from "@repo/design-system/cosmos/kit";
import { useState, useTransition } from "react";
import { saveGeneratedDraft } from "@/app/(charter)/actions/policy";
import { generatePolicyDraft } from "@/app/(charter)/actions/policy-generate";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { Textarea } from "../base";
import { Callout } from "../form-kit";

type Estado = "idle" | "gerando" | "pronto" | "erro";
type Grounded = { id: string; codigo: string; citacao: string };
type Fontes = { casos: number; fornecedores: number; exigencias: number };

const FONTES_VAZIAS: Fontes = { casos: 0, fornecedores: 0, exigencias: 0 };

export function PolicyDraftPreview({
  sectionId,
  sectionName,
  bodyAtual,
  onAccepted,
}: {
  sectionId: string;
  sectionName: string;
  bodyAtual: string;
  onAccepted: () => void;
}) {
  const [, startTransition] = useTransition();
  const [estado, setEstado] = useState<Estado>("idle");
  const [body, setBody] = useState("");
  const [grounded, setGrounded] = useState<Grounded[]>([]);
  const [fontes, setFontes] = useState<Fontes>(FONTES_VAZIAS);
  const [erro, setErro] = useState("");
  const [confirmandoSobrescrita, setConfirmandoSobrescrita] = useState(false);

  const descartar = () => {
    setEstado("idle");
    setBody("");
    setGrounded([]);
    setFontes(FONTES_VAZIAS);
    setErro("");
    setConfirmandoSobrescrita(false);
  };

  const gerar = () => {
    // Sobrescrever texto já escrito por alguém exige um segundo clique — sem
    // window.confirm, no idioma do próprio botão (correção 6 do plano).
    if (bodyAtual.trim() !== "" && !confirmandoSobrescrita) {
      setConfirmandoSobrescrita(true);
      return;
    }
    setConfirmandoSobrescrita(false);
    setEstado("gerando");
    startTransition(async () => {
      const res = await runWithToast(() => generatePolicyDraft({ sectionId }), {
        loading: "Gerando rascunho… ~10s",
        success: "Rascunho pronto para revisão",
      });
      if (res.ok) {
        setBody(res.data.body);
        setGrounded(res.data.grounded);
        setFontes(res.data.fontes);
        setEstado("pronto");
      } else {
        setErro(res.error);
        setEstado("erro");
      }
    });
  };

  const aceitar = () => {
    if (grounded.length === 0) {
      return;
    }
    startTransition(async () => {
      const res = await runWithToast(
        () =>
          saveGeneratedDraft({
            sectionId,
            body,
            groundedRequirementId: grounded[0].id,
          }),
        {
          loading: "Salvando rascunho…",
          success: "Rascunho salvo — entra como Rascunho, não publicado",
        }
      );
      if (res.ok) {
        descartar();
        onAccepted();
      }
    });
  };

  if (estado === "erro") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 16,
        }}
      >
        <Callout icon="alert" tone="red">
          {erro}
        </Callout>
        <Button icon="refresh" onClick={gerar} size="sm" variant="secondary">
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (estado === "pronto") {
    const semInventario = fontes.casos + fontes.fornecedores === 0;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 16,
        }}
      >
        <Textarea
          aria-label={`Rascunho gerado para a seção ${sectionName}`}
          readOnly
          style={{ minHeight: 190, fontSize: 13.5 }}
          value={body}
        />
        <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
          {fontes.exigencias} exigência(s), {fontes.casos} caso(s),{" "}
          {fontes.fornecedores} fornecedor(es)
        </div>
        {semInventario && (
          <Callout icon="alert" tone="amber">
            Rascunho genérico: nenhum caso de uso ou fornecedor no inventário.
            Cadastre-os para um rascunho ancorado na realidade da empresa.
          </Callout>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <span
            style={{
              opacity: grounded.length > 0 ? 1 : 0.45,
              pointerEvents: grounded.length > 0 ? "auto" : "none",
            }}
            title={
              grounded.length > 0
                ? undefined
                : "Sem exigência para fundamentar — cadastre cobertura"
            }
          >
            <Button icon="check" onClick={aceitar} size="md">
              Aceitar rascunho
            </Button>
          </span>
          <Button onClick={descartar} size="md" variant="ghost">
            Descartar
          </Button>
        </div>
      </div>
    );
  }

  // idle | gerando
  const gerando = estado === "gerando";
  return (
    <div style={{ marginTop: 16 }}>
      <span
        style={{
          opacity: gerando ? 0.45 : 1,
          pointerEvents: gerando ? "none" : "auto",
        }}
      >
        <Button icon="sparkles" onClick={gerar} size="md" variant="secondary">
          {gerando
            ? "Gerando rascunho… ~10s"
            : confirmandoSobrescrita
              ? "Gerar por cima do texto atual?"
              : "Gerar rascunho"}
        </Button>
      </span>
    </div>
  );
}
