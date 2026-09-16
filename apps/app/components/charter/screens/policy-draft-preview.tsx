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
import { GatedButton, Textarea } from "../base";
import { Callout, FooterHint } from "../form-kit";

type Estado = "idle" | "gerando" | "pronto" | "erro";
type Grounded = { id: string; codigo: string; citacao: string };
type Fontes = { casos: number; fornecedores: number; exigencias: number };

const FONTES_VAZIAS: Fontes = { casos: 0, fornecedores: 0, exigencias: 0 };

const GERAR_DESABILITADO_MOTIVO = "Somente Legal ou Compliance edita seção";
const ACEITAR_DESABILITADO_MOTIVO =
  "Sem exigência para fundamentar — cadastre cobertura";

export function PolicyDraftPreview({
  sectionId,
  sectionName,
  bodyAtual,
  onAccepted,
  canEdit,
}: {
  sectionId: string;
  sectionName: string;
  bodyAtual: string;
  onAccepted: () => void;
  canEdit: boolean;
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
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <GatedButton
              allowed={grounded.length > 0}
              icon="check"
              onClick={aceitar}
              reason={ACEITAR_DESABILITADO_MOTIVO}
            >
              Aceitar rascunho
            </GatedButton>
            <Button onClick={descartar} size="md" variant="ghost">
              Descartar
            </Button>
          </div>
          {grounded.length === 0 && (
            <FooterHint>{ACEITAR_DESABILITADO_MOTIVO}</FooterHint>
          )}
        </div>
      </div>
    );
  }

  // idle | gerando
  const gerando = estado === "gerando";
  const habilitado = canEdit && !gerando;
  const motivoDesabilitado = canEdit ? "" : GERAR_DESABILITADO_MOTIVO;
  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <GatedButton
        allowed={habilitado}
        icon="sparkles"
        onClick={gerar}
        reason={motivoDesabilitado}
        variant="secondary"
      >
        {gerando
          ? "Gerando rascunho… ~10s"
          : confirmandoSobrescrita
            ? "Gerar por cima do texto atual?"
            : "Gerar rascunho"}
      </GatedButton>
      {!canEdit && <FooterHint>{motivoDesabilitado}</FooterHint>}
    </div>
  );
}
