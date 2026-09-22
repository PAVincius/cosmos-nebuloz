"use client";

import { Badge } from "@repo/design-system/cosmos/kit";
import { type ReactNode, useCallback, useState } from "react";
import type { PessoaCapacidade } from "@/app/actions/capacity";
import type { EngagementRow } from "@/app/actions/engagements";
import { createIpAssetAction, type IpAssetRow } from "@/app/actions/ip-library";
import type { ServiceRow } from "@/app/actions/services";
import { BotaoPrimario, Campo, INPUT } from "@/components/campo";
import { Secao } from "@/components/secao";
import { type Formulario, montarPayloadDeCriacao } from "@/lib/ip/formulario";
import {
  avaliarRegua,
  type Criterio,
  criteriosPendentes,
  LICENCAS,
  type Licenca,
  MIN_DESCRICAO,
  maturidadeDe,
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

// Exportados porque `biblioteca.tsx` precisa dos mesmos rótulos nas badges da
// linha do ativo — uma segunda cópia divergiria no primeiro ajuste de texto.
export const ROTULO_MATURIDADE: Record<"RASCUNHO" | "COMPROVADO", string> = {
  RASCUNHO: "Rascunho",
  COMPROVADO: "Comprovado",
};

const ROTULO_TIPO: Record<TipoDeAtivo, string> = {
  ACELERADOR: "Acelerador",
  PLAYBOOK: "Playbook",
  TEMPLATE: "Template",
  EVAL_HARNESS: "Eval harness",
  MODELO_BPMN: "Modelo BPMN",
  DOCUMENTO: "Documento",
};

export const ROTULO_PROCEDENCIA: Record<Procedencia, string> = {
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

export const ROTULO_LICENCA: Record<Licenca, string> = {
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

const CHIP: React.CSSProperties = {
  padding: "6px 11px",
  borderRadius: "var(--r-sm)",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};

function estiloDoChip(ativo: boolean): React.CSSProperties {
  return {
    ...CHIP,
    border: `1px solid ${ativo ? "var(--accent)" : "var(--hairline)"}`,
    background: ativo ? "var(--accent-soft)" : "var(--surface-2)",
    color: ativo ? "var(--ink)" : "var(--ink-muted)",
  };
}

/** Chip alternável — só para escolha múltipla (os serviços). Para escolha
 *  única é `OpcaoDeChip`: `aria-pressed` num grupo em que só um fica ativo
 *  faz o leitor de tela anunciar "pressionado" sem dizer "1 de 4". */
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
      style={estiloDoChip(ativo)}
      type="button"
    >
      {children}
    </button>
  );
}

/** A mesma aparência do chip, com um rádio nativo dentro: escolha única.
 *  O rádio fica visível (não `sr-only`) para o anel de foco do cosmos.css
 *  continuar aparecendo. Mesmo padrão de `clientes/novo/form.tsx`. */
function OpcaoDeChip({
  nome,
  valor,
  ativo,
  onEscolher,
  children,
}: {
  nome: string;
  valor: string;
  ativo: boolean;
  onEscolher: () => void;
  children: string;
}) {
  return (
    <label
      style={{
        ...estiloDoChip(ativo),
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <input
        checked={ativo}
        name={nome}
        onChange={onEscolher}
        style={{ margin: 0 }}
        type="radio"
        value={valor}
      />
      {children}
    </label>
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
  escolhaUnica = false,
  children,
}: {
  label: string;
  /** `role="radiogroup"` no fieldset: o leitor anuncia "1 de 4" nos rádios
   *  de dentro. Sem isto é só "grupo". Serviços (escolha múltipla) não usa. */
  escolhaUnica?: boolean;
  children: ReactNode;
}) {
  // Fora do JSX por causa do noLeakedRender.
  const papel = escolhaUnica ? "radiogroup" : undefined;
  return (
    <fieldset role={papel} style={RESET_FIELDSET}>
      <legend className="mono" style={LEGENDA}>
        {label}
      </legend>
      {children}
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
      <CampoDeGrupo escolhaUnica label="Procedência">
        <div style={LINHA_CHIPS}>
          {PROCEDENCIAS.map((p) => (
            <OpcaoDeChip
              ativo={p === form.procedencia}
              key={p}
              nome="ip-procedencia"
              onEscolher={() => alterar({ procedencia: p })}
              valor={p}
            >
              {ROTULO_PROCEDENCIA[p]}
            </OpcaoDeChip>
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
      <CampoDeGrupo escolhaUnica label="Licença de terceiro">
        <div style={LINHA_CHIPS}>
          {LICENCAS.map((l) => (
            <OpcaoDeChip
              ativo={l === form.licenca}
              key={l}
              nome="ip-licenca"
              onEscolher={() => alterar({ licenca: l })}
              valor={l}
            >
              {ROTULO_LICENCA[l]}
            </OpcaoDeChip>
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
    <CampoDeGrupo label="Serviços que ele encurta">
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
            {/* O estado em palavra, além da cor e do glifo (que é
                `aria-hidden`): sem isto o leitor de tela lia seis critérios
                iguais. Em `ink-muted`/`ink-faint`, não em verde/âmbar —
                esses reprovam AA como texto no tema claro. */}
            <span
              className="mono"
              style={{
                fontSize: "var(--fs-micro)",
                fontWeight: 700,
                color: c.ok ? "var(--ink-muted)" : "var(--ink-faint)",
              }}
            >
              {c.ok ? "atende" : "falta"}
            </span>
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
          <Badge tone="amber">{ROTULO_MATURIDADE[maturidadeDe(0)]}</Badge>
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
    const res = await createIpAssetAction(montarPayloadDeCriacao(form));
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
            aria-describedby="ip-descricao-contador"
            id="ip-descricao"
            onChange={(e) => alterar({ descricao: e.target.value })}
            style={{ ...INPUT, minHeight: 76, resize: "vertical" }}
            value={form.descricao}
          />
        </Campo>
        <span
          className="mono"
          id="ip-descricao-contador"
          style={{
            fontSize: "var(--fs-micro)",
            color:
              tamanhoDescricao >= MIN_DESCRICAO
                ? "var(--green-text)"
                : "var(--ink-faint)",
          }}
        >
          {tamanhoDescricao}/{MIN_DESCRICAO}
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

      <Secao icon="ruler" title="Régua de aceitação">
        <PainelDaRegua
          criterios={criterios}
          form={form}
          nomeDoDono={dono ? dono.nome : "Sem dono"}
        />
      </Secao>

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
          {salvando ? "Registrando…" : "Registrar como rascunho"}
        </BotaoPrimario>
      </div>
    </div>
  );
}
