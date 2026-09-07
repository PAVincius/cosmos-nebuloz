"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { type ReactNode, useCallback, useState } from "react";
import type { PessoaCapacidade } from "@/app/actions/capacity";
import type { EngagementRow } from "@/app/actions/engagements";
import { createIpAssetAction, type IpAssetRow } from "@/app/actions/ip-library";
import type { ServiceRow } from "@/app/actions/services";
import { BotaoPrimario, Campo, INPUT } from "@/components/campo";
import {
  avaliarRegua,
  type Criterio,
  criteriosPendentes,
  type EntradaDeAtivo,
  LICENCAS,
  type Licenca,
  PROCEDENCIAS,
  type Procedencia,
  TIPOS_DE_ATIVO,
  type TipoDeAtivo,
} from "@/lib/ip/regua";

/**
 * Cadastro de ativo do catálogo de IP.
 *
 * Campos à esquerda, régua ao vivo à direita: a lista de critérios que a
 * pessoa lê enquanto digita vem de `avaliarRegua`, a mesma função que a action
 * roda antes de gravar. Reescrever as condições aqui em `if` local daria duas
 * listas, e a divergente seria justamente a que ela leu antes de clicar.
 */

/** O mínimo da IP-R2, para o contador sob a descrição. */
const MINIMO_DESCRICAO = 40;

const ROTULO_TIPO: Record<TipoDeAtivo, string> = {
  ACELERADOR: "Acelerador",
  PLAYBOOK: "Playbook",
  TEMPLATE: "Template",
  EVAL_HARNESS: "Eval harness",
  MODELO_BPMN: "Modelo BPMN",
  DOCUMENTO: "Documento",
};

const ROTULO_PROCEDENCIA: Record<Procedencia, string> = {
  INTERNO: "Investimento interno",
  ENGAJAMENTO: "Engajamento de cliente",
  LAB: "LAB",
  TERCEIRO: "Base de terceiro",
};

const NOTA_PROCEDENCIA: Record<Procedencia, string> = {
  INTERNO: "Construído em tempo não faturado. Reuso livre.",
  ENGAJAMENTO: "Nasceu em entrega paga. Exige cláusula de reuso no contrato.",
  LAB: "Saída de pesquisa interna. Verificar licença do dataset de origem.",
  TERCEIRO: "Adaptação de material de fora. A licença manda.",
};

const ROTULO_LICENCA: Record<Licenca, string> = {
  NENHUMA: "Nenhuma",
  PERMISSIVA: "Permissiva",
  COPYLEFT: "Copyleft",
  COMERCIAL: "Licenciada",
  NAO_RESOLVIDA: "Não resolvida",
};

const NOTA_LICENCA: Record<Licenca, string> = {
  NENHUMA: "Nada de terceiro dentro do ativo.",
  PERMISSIVA: "MIT, Apache-2.0, BSD. Reuso comercial liberado com atribuição.",
  COPYLEFT:
    "GPL, AGPL. Contamina o entregável do cliente — revisar antes de vender.",
  COMERCIAL: "Metodologia ou software pago. Exige número de licença.",
  NAO_RESOLVIDA:
    "Bloqueia o registro. Sem licença conhecida não existe direito de reuso.",
};

/** As duas licenças que só valem com componente e versão escritos. */
const PLACEHOLDER_REFERENCIA: Partial<Record<Licenca, string>> = {
  COPYLEFT: "bpmn-js AGPL-3.0",
  COMERCIAL: "Prosci ADKAR — LIC-2026-014",
};

/**
 * O estado do formulário é a entrada da régua mais o que a régua não julga:
 * tipo e dono não entram em critério nenhum, mas entram no ativo.
 */
type Formulario = EntradaDeAtivo & {
  tipo: TipoDeAtivo;
  donoPersonId: string;
};

type Alterar = (patch: Partial<Formulario>) => void;

const VAZIO: Formulario = {
  nome: "",
  descricao: "",
  link: "",
  viveAqui: false,
  servicos: [],
  procedencia: "INTERNO",
  origemEngagementId: null,
  reusoConfirmado: false,
  licenca: "NENHUMA",
  licencaRef: "",
  tipo: "ACELERADOR",
  donoPersonId: "",
};

const NOTA: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-nota)",
  lineHeight: 1.5,
  color: "var(--ink-muted)",
};

const LINHA_CHIPS: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      aria-pressed={ativo}
      className="btn"
      onClick={onClick}
      style={{
        padding: "6px 11px",
        borderRadius: "var(--r-sm)",
        fontSize: "var(--fs-nota)",
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        border: `1px solid ${ativo ? "var(--accent)" : "var(--hairline)"}`,
        background: ativo ? "var(--accent-soft)" : "var(--surface-2)",
        color: ativo ? "var(--ink)" : "var(--ink-muted)",
      }}
      type="button"
    >
      {children}
    </button>
  );
}

/** Caixa de confirmação com texto ao lado, no formato das telas vizinhas. */
function Marcador({
  id,
  marcado,
  onMarcar,
  children,
}: {
  id: string;
  marcado: boolean;
  onMarcar: (v: boolean) => void;
  children: string;
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        fontSize: "var(--fs-base)",
        fontWeight: 600,
        lineHeight: 1.45,
        cursor: "pointer",
      }}
    >
      <input
        checked={marcado}
        id={id}
        onChange={(e) => onMarcar(e.target.checked)}
        style={{ marginTop: 3, cursor: "pointer" }}
        type="checkbox"
      />
      <span>{children}</span>
    </label>
  );
}

const RESET_FIELDSET: React.CSSProperties = {
  margin: 0,
  padding: 0,
  border: "none",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const LEGENDA: React.CSSProperties = {
  padding: 0,
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
};

/**
 * Mesma aparência de `Campo`, mas para um grupo de controles (os chips de
 * procedência, licença e serviços) em vez de um único input. Um `<label
 * htmlFor>` apontando para o `<div>` que envolve os chips não navega para
 * lugar nenhum; `fieldset`/`legend` é a marcação correta para "rótulo de um
 * grupo".
 */
function CampoDeGrupo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset style={RESET_FIELDSET}>
      <legend className="mono" style={LEGENDA}>
        {label}
      </legend>
      {children}
      {hint ? (
        <span
          style={{
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
            fontWeight: 500,
          }}
        >
          {hint}
        </span>
      ) : null}
    </fieldset>
  );
}

function BlocoDeProcedencia({
  form,
  alterar,
  engajamentos,
}: {
  form: Formulario;
  alterar: Alterar;
  engajamentos: EngagementRow[];
}) {
  const escolhido = engajamentos.find((e) => e.id === form.origemEngagementId);
  const cliente = escolhido ? escolhido.clienteNome : "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <CampoDeGrupo label="Procedência">
        <div style={LINHA_CHIPS}>
          {PROCEDENCIAS.map((p) => (
            <Chip
              ativo={p === form.procedencia}
              key={p}
              onClick={() => alterar({ procedencia: p })}
            >
              {ROTULO_PROCEDENCIA[p]}
            </Chip>
          ))}
        </div>
      </CampoDeGrupo>
      <p style={NOTA}>{NOTA_PROCEDENCIA[form.procedencia]}</p>

      {form.procedencia === "ENGAJAMENTO" ? (
        <>
          <Campo htmlFor="ip-engajamento" label="Engajamento de origem">
            <select
              id="ip-engajamento"
              onChange={(e) =>
                alterar({ origemEngagementId: e.target.value || null })
              }
              style={{ ...INPUT, cursor: "pointer" }}
              value={form.origemEngagementId ?? ""}
            >
              <option value="">Nenhum</option>
              {engajamentos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo} · {e.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Marcador
            id="ip-reuso-confirmado"
            marcado={form.reusoConfirmado}
            onMarcar={(v) => alterar({ reusoConfirmado: v })}
          >
            {`Confirmo cláusula de reuso no contrato de ${cliente}`}
          </Marcador>
          <p style={NOTA}>
            Sem essa cláusula o artefato é IP do cliente. Registrar assim cria
            passivo, não ativo (IP-R5).
          </p>
        </>
      ) : null}
    </div>
  );
}

function BlocoDeLicenca({
  form,
  alterar,
}: {
  form: Formulario;
  alterar: Alterar;
}) {
  const placeholder = PLACEHOLDER_REFERENCIA[form.licenca];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <CampoDeGrupo label="Licença de terceiro">
        <div style={LINHA_CHIPS}>
          {LICENCAS.map((l) => (
            <Chip
              ativo={l === form.licenca}
              key={l}
              onClick={() => alterar({ licenca: l })}
            >
              {ROTULO_LICENCA[l]}
            </Chip>
          ))}
        </div>
      </CampoDeGrupo>
      <p style={NOTA}>{NOTA_LICENCA[form.licenca]}</p>

      {placeholder ? (
        <Campo htmlFor="ip-licenca-ref" label="Componente e versão">
          <input
            id="ip-licenca-ref"
            onChange={(e) => alterar({ licencaRef: e.target.value })}
            placeholder={placeholder}
            style={INPUT}
            value={form.licencaRef}
          />
        </Campo>
      ) : null}
    </div>
  );
}

function BlocoDeServicos({
  form,
  alterar,
  servicos,
}: {
  form: Formulario;
  alterar: Alterar;
  servicos: ServiceRow[];
}) {
  const alternar = (id: string) =>
    alterar({
      servicos: form.servicos.includes(id)
        ? form.servicos.filter((s) => s !== id)
        : [...form.servicos, id],
    });

  return (
    <CampoDeGrupo
      hint="o que o ativo encurta na entrega — sem serviço, ninguém encontra o ativo quando precisa dele"
      label="Serviços que ele encurta"
    >
      {servicos.length === 0 ? (
        <p style={NOTA}>
          Nenhum serviço no catálogo. Sem um serviço para marcar, a IP-R4 nunca
          fecha — cadastre um serviço antes de registrar este ativo.
        </p>
      ) : (
        <div style={LINHA_CHIPS}>
          {servicos.map((s) => (
            <Chip
              ativo={form.servicos.includes(s.id)}
              key={s.id}
              onClick={() => alternar(s.id)}
            >
              {`${s.codigo} · ${s.nome}`}
            </Chip>
          ))}
        </div>
      )}
    </CampoDeGrupo>
  );
}

function PainelDaRegua({
  form,
  criterios,
  nomeDoDono,
}: {
  form: Formulario;
  criterios: Criterio[];
  nomeDoDono: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {criterios.map((c) => (
          <li
            key={c.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "6px 0",
              fontSize: "var(--fs-nota)",
              lineHeight: 1.45,
              color: c.ok ? "var(--ink)" : "var(--ink-muted)",
            }}
          >
            <span aria-hidden="true">{c.ok ? "☑" : "☐"}</span>
            <span style={{ flex: 1, minWidth: 0 }}>{c.texto}</span>
            <span
              className="mono"
              style={{ fontSize: "var(--fs-micro)", color: "var(--ink-faint)" }}
            >
              {c.id}
            </span>
          </li>
        ))}
      </ul>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 11,
          borderRadius: "var(--r-md)",
          border: "1px solid var(--hairline)",
          background: "var(--surface-2)",
        }}
      >
        <span style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
          {form.nome.trim() || "Sem nome"}
        </span>
        <div style={LINHA_CHIPS}>
          <Badge tone="neutral">{ROTULO_TIPO[form.tipo]}</Badge>
          <Badge tone="amber">Rascunho</Badge>
        </div>
        <span
          className="mono"
          style={{ fontSize: "var(--fs-micro)", color: "var(--ink-faint)" }}
        >
          {nomeDoDono} · {ROTULO_PROCEDENCIA[form.procedencia]} ·{" "}
          {ROTULO_LICENCA[form.licenca]}
        </span>
      </div>
    </div>
  );
}

export function RegistrarAtivo({
  onCriado,
  onErro,
  servicos,
  pessoas,
  engajamentos,
}: {
  onCriado: (ativo: IpAssetRow) => void;
  onErro: (mensagem: string) => void;
  servicos: ServiceRow[];
  pessoas: PessoaCapacidade[];
  engajamentos: EngagementRow[];
}) {
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const alterar = useCallback<Alterar>((patch) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const criterios = avaliarRegua(form);
  const pendentes = criteriosPendentes(criterios);
  const tamanhoDescricao = form.descricao.trim().length;
  const dono = pessoas.find((p) => p.id === form.donoPersonId);

  const criar = useCallback(async () => {
    setSalvando(true);
    const res = await createIpAssetAction({
      nome: form.nome,
      tipo: form.tipo,
      descricao: form.descricao,
      // Derivado do nome, como o formulário anterior já fazia: o corpo do
      // ativo nasce com o título e cresce no editor.
      conteudo: `# ${form.nome}\n\n`,
      link: form.viveAqui ? undefined : form.link,
      viveAqui: form.viveAqui,
      donoPersonId: form.donoPersonId || undefined,
      servicoIds: form.servicos,
      procedencia: form.procedencia,
      origemEngagementId: form.origemEngagementId ?? undefined,
      reusoConfirmado: form.reusoConfirmado,
      licenca: form.licenca,
      licencaRef: form.licencaRef || undefined,
    });
    setSalvando(false);
    if (res.ok) {
      setForm(VAZIO);
      onCriado(res.data);
      return;
    }
    onErro(res.error);
  }, [form, onCriado, onErro]);

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        gridTemplateColumns: "minmax(0,1.7fr) minmax(0,1fr)",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Campo htmlFor="ip-nome" label="Nome">
          <input
            id="ip-nome"
            onChange={(e) => alterar({ nome: e.target.value })}
            style={INPUT}
            value={form.nome}
          />
        </Campo>

        <Campo htmlFor="ip-descricao" label="Problema que ele resolve">
          <textarea
            id="ip-descricao"
            onChange={(e) => alterar({ descricao: e.target.value })}
            style={{ ...INPUT, minHeight: 76, resize: "vertical" }}
            value={form.descricao}
          />
        </Campo>
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-micro)",
            color:
              tamanhoDescricao >= MINIMO_DESCRICAO
                ? "var(--green-text)"
                : "var(--ink-faint)",
          }}
        >
          {tamanhoDescricao}/{MINIMO_DESCRICAO}
        </span>

        <Campo htmlFor="ip-tipo" label="Tipo">
          <select
            id="ip-tipo"
            onChange={(e) => alterar({ tipo: e.target.value as TipoDeAtivo })}
            style={{ ...INPUT, cursor: "pointer" }}
            value={form.tipo}
          >
            {TIPOS_DE_ATIVO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo htmlFor="ip-dono" label="Dono">
          <select
            id="ip-dono"
            onChange={(e) => alterar({ donoPersonId: e.target.value })}
            style={{ ...INPUT, cursor: "pointer" }}
            value={form.donoPersonId}
          >
            <option value="">Ninguém</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Marcador
          id="ip-vive-aqui"
          marcado={form.viveAqui}
          onMarcar={(v) => alterar({ viveAqui: v })}
        >
          O ativo vive aqui, no editor do catálogo
        </Marcador>

        {form.viveAqui ? null : (
          <Campo
            hint="onde o ativo vive de verdade — repositório, pasta, quadro"
            htmlFor="ip-link"
            label="Endereço"
          >
            <input
              id="ip-link"
              onChange={(e) => alterar({ link: e.target.value })}
              style={INPUT}
              value={form.link}
            />
          </Campo>
        )}

        <BlocoDeServicos alterar={alterar} form={form} servicos={servicos} />
        <BlocoDeProcedencia
          alterar={alterar}
          engajamentos={engajamentos}
          form={form}
        />
        <BlocoDeLicenca alterar={alterar} form={form} />
      </div>

      <SectionCard icon="ruler" title="Régua de aceitação">
        <PainelDaRegua
          criterios={criterios}
          form={form}
          nomeDoDono={dono ? dono.nome : "Sem dono"}
        />
      </SectionCard>

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 4,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "var(--fs-nota)",
            fontWeight: 600,
            color:
              pendentes.length === 0 ? "var(--green-text)" : "var(--ink-muted)",
          }}
        >
          {pendentes.length === 0
            ? "Régua de aceitação atendida"
            : `${pendentes.length} de ${criterios.length} critérios pendentes`}
        </span>
        <BotaoPrimario
          disabled={pendentes.length > 0 || salvando}
          full={false}
          onClick={criar}
          type="button"
        >
          {salvando ? "Registrando…" : "Registrar ativo"}
        </BotaoPrimario>
      </div>
    </div>
  );
}
