"use client";

// compliance-import.tsx — ImportQuickAddForm, movido de compliance.tsx no
// split que deu folga ao size:guard (a tela estava na baseline de 1025
// linhas). Anatomia preservada 1:1; só muda export/imports.

import { useState, useTransition } from "react";
import {
  importRequirementSet,
  publishSetVersion,
  type SetRow,
} from "@/app/(charter)/actions/compliance";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { Field, GatedButton, Input, Select, Textarea } from "../base";

type ParsedRequisito = { codigo: string; citacao: string; resumo: string };

const REQUISITOS_PLACEHOLDER =
  "4.2.1 | RFP §4.2.1 | Retenção de dados por 5 anos\n" +
  "4.2.2 | RFP §4.2.2 | Criptografia em repouso obrigatória";

/**
 * Spec §5.1: "colar exigências, uma por linha". Pipe (`|`) separa os três
 * campos — raro em citação/resumo em prosa jurídica, ao contrário de vírgula
 * ou ponto-e-vírgula — e só os dois primeiros pipes de cada linha contam:
 * qualquer `|` a mais dentro do resumo (o único campo de texto livre)
 * permanece ali, em vez de espalhar a linha em pedaços a mais. Formato
 * documentado no hint do campo — ninguém adivinha um delimitador.
 *
 * Linha em branco é ruído de colagem, não erro. Linha sem os dois
 * separadores, ou com algum campo vazio, é recusada nomeando a linha — a
 * mesma disciplina que `importRequirementSet` já aplica a código duplicado
 * (actions/compliance.ts): adivinhar o que a pessoa quis dizer é decidir por
 * ela o que vai responder a um comprador.
 */
function parseRequisitosPaste(text: string): {
  requisitos: ParsedRequisito[];
  error: string | null;
} {
  const requisitos: ParsedRequisito[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      continue;
    }
    const first = line.indexOf("|");
    const second = first === -1 ? -1 : line.indexOf("|", first + 1);
    if (second === -1) {
      return {
        requisitos: [],
        error: `Linha ${i + 1}: formato inválido — use "código | citação | resumo".`,
      };
    }
    const codigo = line.slice(0, first).trim();
    const citacao = line.slice(first + 1, second).trim();
    const resumo = line.slice(second + 1).trim();
    if (!(codigo && citacao && resumo)) {
      return {
        requisitos: [],
        error: `Linha ${i + 1}: código, citação e resumo não podem ficar em branco.`,
      };
    }
    requisitos.push({ codigo, citacao, resumo });
  }
  return { requisitos, error: null };
}

/** Cola quantas exigências a pessoa tiver — nome do conjunto + uma exigência
 *  por linha (spec §5.1). O resto chega por nova versão (publishSetVersion)
 *  ou pela seed de regulação (Task 10); este formulário não substitui as
 *  duas, só tira um conjunto do zero ou soma a ele. */
export function ImportQuickAddForm({
  sets,
  onCancel,
  onDone,
}: {
  sets: SetRow[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [requisitosText, setRequisitosText] = useState("");
  const [supersedesId, setSupersedesId] = useState("");
  const [versao, setVersao] = useState("");

  const parsed = parseRequisitosPaste(requisitosText);
  // Só entra em jogo quando a pessoa escolheu um conjunto pra substituir —
  // sem escolha, o caminho é importRequirementSet e a versão não importa.
  const versaoObrigatoria = supersedesId !== "" && versao.trim() === "";
  const ready =
    nome.trim() !== "" &&
    parsed.error === null &&
    parsed.requisitos.length > 0 &&
    !versaoObrigatoria;
  const reason =
    (versaoObrigatoria ? "Informe a versão do conjunto novo" : null) ??
    parsed.error ??
    (parsed.requisitos.length === 0
      ? "Cole ao menos uma exigência, uma por linha"
      : "Preencha o nome do conjunto");

  const submit = () =>
    startTransition(async () => {
      // Com conjunto selecionado o caminho é outro: publishSetVersion grava
      // supersedesId e transporta a cobertura, marcando REVISAR no que mudou
      // de texto. Importar como conjunto novo perderia todos os vereditos já
      // dados sobre a versão anterior.
      const res = supersedesId
        ? await runWithToast(
            () =>
              publishSetVersion({
                supersedesId,
                nome,
                versao,
                requisitos: parsed.requisitos,
              }),
            {
              loading: "Publicando nova versão…",
              success: (d) =>
                `Nova versão publicada · ${d.afetadas} em revisão`,
            }
          )
        : await runWithToast(
            () =>
              importRequirementSet({
                nome,
                origem: "RFP",
                requisitos: parsed.requisitos,
              }),
            {
              loading: "Importando conjunto…",
              success: (d) => `${d.total} exigência(s) importada(s)`,
            }
          );
      if (res.ok) {
        onDone();
      }
    });

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "18px auto 4px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 18,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
      }}
    >
      <Field
        htmlFor="conformidade-import-nome"
        label="Nome do conjunto"
        required
      >
        <Input
          id="conformidade-import-nome"
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex: RFP Banco Aurora 2026"
          value={nome}
        />
      </Field>
      <Field
        error={parsed.error ?? undefined}
        hint='Uma exigência por linha, no formato "código | citação | resumo".'
        htmlFor="conformidade-import-requisitos"
        label="Exigências"
        required
      >
        <Textarea
          id="conformidade-import-requisitos"
          onChange={(e) => setRequisitosText(e.target.value)}
          placeholder={REQUISITOS_PLACEHOLDER}
          rows={6}
          value={requisitosText}
        />
      </Field>
      <Field
        htmlFor="conformidade-import-supersedes"
        label="Substitui um conjunto existente"
      >
        <Select
          ariaLabel="Substitui um conjunto existente"
          id="conformidade-import-supersedes"
          onChange={setSupersedesId}
          options={[
            { value: "", label: "Não — é um conjunto novo" },
            // Nunca um conjunto global aqui: publishSetVersion recusa
            // supersedesId de conjunto global no servidor — filtrar já na
            // tela poupa o round-trip que só voltaria com esse erro.
            ...sets
              .filter((s) => !s.global)
              .map((s) => ({
                value: s.id,
                label: `${s.nome} (v${s.versao})`,
              })),
          ]}
          value={supersedesId}
        />
      </Field>
      {supersedesId !== "" && (
        <Field htmlFor="conformidade-import-versao" label="Versão">
          <Input
            id="conformidade-import-versao"
            onChange={(e) => setVersao(e.target.value)}
            placeholder="2"
            value={versao}
          />
        </Field>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <GatedButton
          allowed={!pending}
          onClick={onCancel}
          reason="Importação em andamento"
          variant="secondary"
        >
          Cancelar
        </GatedButton>
        <GatedButton
          allowed={ready && !pending}
          icon="upload"
          onClick={submit}
          reason={reason}
        >
          {pending ? "Importando…" : "Importar"}
        </GatedButton>
      </div>
    </div>
  );
}
