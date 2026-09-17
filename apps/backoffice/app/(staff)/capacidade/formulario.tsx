"use client";

import { type FormEvent, useCallback, useState, useTransition } from "react";
import {
  createPersonAction,
  type PessoaCapacidade,
} from "@/app/actions/capacity";
import { BotaoPrimario, Campo, INPUT } from "@/components/campo";
import { horasNaJanela, semanasDaJanela } from "@/lib/capacidade/janela";
import { formatarDataBr } from "@/lib/empresa/periodo";

/**
 * Formulário de entrada de capacidade — pessoa ou terceiro.
 *
 * Fora de `capacidade.tsx` porque só ele conhece o tipo escolhido e as regras
 * da janela; deixar isso na tela misturava a validação do cadastro com a da
 * alocação, que não têm nada em comum. Virou arquivo próprio quando a tela
 * ganhou pendente e confirmação e passou do teto de 800 linhas da catraca.
 */

const VIRGULA = /\s*,\s*/;

/**
 * Os dois tipos de capacidade. A escolha não vira coluna no banco: ela decide
 * se "Sai em" é obrigatório, e ter data de saída É o que faz alguém terceiro.
 */
const TIPOS = [
  {
    id: "pessoa",
    label: "Pessoa",
    hint: "Entra no plano sem data de saída prevista",
  },
  {
    id: "terceiro",
    label: "Terceiro",
    hint: "Capacidade temporária, com janela de contrato",
  },
] as const;

type Tipo = (typeof TIPOS)[number]["id"];

/** Escolha única entre os dois tipos — rádio nativo dentro do cartão, não
 *  botão com `aria-pressed`: o leitor anuncia "1 de 2" e as setas trocam.
 *  O rádio fica visível para o anel de foco do cosmos.css continuar
 *  aparecendo. Mesmo padrão de `clientes/novo/form.tsx`. */
function CardsDeTipo({
  tipo,
  onTipo,
}: {
  tipo: Tipo;
  onTipo: (t: Tipo) => void;
}) {
  return (
    <div
      aria-label="Tipo"
      role="radiogroup"
      style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}
    >
      {TIPOS.map((t) => {
        const ativo = t.id === tipo;
        return (
          <label
            key={t.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              textAlign: "left",
              cursor: "pointer",
              border: `1px solid ${ativo ? "var(--accent)" : "var(--hairline)"}`,
              background: ativo ? "var(--surface-3)" : "none",
            }}
          >
            <input
              checked={ativo}
              name="tipo-de-capacidade"
              onChange={() => onTipo(t.id)}
              style={{ margin: "3px 0 0" }}
              type="radio"
              value={t.id}
            />
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
                {t.label}
              </span>
              <span
                style={{
                  fontSize: "var(--fs-nota)",
                  color: "var(--ink-muted)",
                  lineHeight: 1.4,
                }}
              >
                {t.hint}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * O que a janela dá em horas. O design de referência mostra R$ aqui; sem
 * tabela de papel/hora no back-office, o número em reais seria inventado — e
 * rodapé inventado é pior que rodapé nenhum.
 */
function FaixaDaJanela({
  horasSemana,
  entraEm,
  saiEm,
}: {
  horasSemana: number;
  entraEm: string;
  saiEm: string;
}) {
  const janela = {
    entraEm: entraEm ? new Date(entraEm) : null,
    saiEm: saiEm ? new Date(saiEm) : null,
  };
  const semanas = semanasDaJanela(janela);
  const horas = horasNaJanela(horasSemana, janela);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: "10px 14px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".04em",
          }}
        >
          Horas na janela
        </span>
        <span
          className="mono"
          style={{ fontSize: 19, fontWeight: 700, color: "var(--ink)" }}
        >
          {horas === null ? "—" : `${horas}h`}
        </span>
      </span>
      <span
        style={{
          fontSize: "var(--fs-nota)",
          color: "var(--ink-muted)",
          lineHeight: 1.5,
          marginLeft: "auto",
          textAlign: "right",
        }}
      >
        {semanas === null
          ? "Sem as duas datas não dá para dizer quantas semanas."
          : `${semanas} ${semanas === 1 ? "semana" : "semanas"} de ${formatarDataBr(entraEm)} a ${formatarDataBr(saiEm)}`}
      </span>
    </div>
  );
}

/**
 * Formulário de entrada de capacidade. Fora da tela porque só ele conhece o
 * tipo escolhido e as regras da janela — deixar isso em `Capacidade` misturava
 * a validação do cadastro com a da alocação, que não têm nada em comum.
 */
export function FormularioDeCapacidade({
  onCriada,
  onErro,
}: {
  onCriada: (p: PessoaCapacidade) => void;
  onErro: (msg: string) => void;
}) {
  const [tipo, setTipo] = useState<Tipo>("pessoa");
  const [pessoa, setPessoa] = useState({
    nome: "",
    email: "",
    habilidades: "",
    horas: "40",
    entraEm: "",
    saiEm: "",
    observacao: "",
  });
  // `useTransition` em vez de um `salvando` à mão: o `pendente` desabilita o
  // botão no mesmo render em que o envio começa, e é isso que faz o segundo
  // clique não criar uma segunda pessoa.
  const [pendente, iniciar] = useTransition();

  const cadastrar = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const habilidades = pessoa.habilidades
        .split(VIRGULA)
        .map((h) => h.trim())
        .filter(Boolean);
      const horasSemana = Number(pessoa.horas) || 40;
      // Só o terceiro tem saída: em "Pessoa" uma data digitada antes da troca
      // de tipo não pode viajar escondida no envio.
      const saiEm = tipo === "terceiro" ? pessoa.saiEm : "";
      const observacao = pessoa.observacao.trim();

      iniciar(async () => {
        const res = await createPersonAction({
          nome: pessoa.nome,
          email: pessoa.email,
          habilidades,
          horasSemana,
          entraEm: pessoa.entraEm || undefined,
          saiEm: saiEm || undefined,
          observacao: observacao || undefined,
        });
        if (!res.ok) {
          onErro(res.error);
          return;
        }
        onCriada({
          id: res.data.id,
          nome: pessoa.nome,
          email: pessoa.email,
          habilidades,
          horasSemana,
          entraEm: pessoa.entraEm || null,
          saiEm: saiEm || null,
          observacao: observacao || null,
          ativo: true,
          ocupacaoAtual: 0,
          alocacoes: [],
        });
      });
    },
    [pessoa, tipo, onCriada, onErro]
  );

  // Terceiro sem as duas pontas da janela não tem como entrar: é a data de
  // saída que o distingue, e sem entrada não há quantas semanas ele cobre.
  const janelaOk =
    tipo === "pessoa" ||
    Boolean(pessoa.entraEm && pessoa.saiEm && pessoa.saiEm >= pessoa.entraEm);
  const podeCadastrar =
    pessoa.nome.trim().length >= 2 && pessoa.email.includes("@") && janelaOk;

  return (
    // `<form>` e não `<div>`: é o que faz Enter num campo submeter. Os cartões
    // de tipo já são `type="button"`, então só o botão de gravar submete.
    <form
      aria-label="Nova pessoa"
      onSubmit={cadastrar}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingBottom: 14,
        marginBottom: 14,
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <CardsDeTipo
        onTipo={(t) => {
          setTipo(t);
          if (t === "pessoa") {
            setPessoa((p) => ({ ...p, saiEm: "" }));
          }
        }}
        tipo={tipo}
      />
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        }}
      >
        <Campo htmlFor="p-nome" label="Nome">
          <input
            id="p-nome"
            onChange={(e) => setPessoa((p) => ({ ...p, nome: e.target.value }))}
            style={INPUT}
            value={pessoa.nome}
          />
        </Campo>
        <Campo htmlFor="p-email" label="E-mail">
          <input
            id="p-email"
            onChange={(e) =>
              setPessoa((p) => ({ ...p, email: e.target.value }))
            }
            style={INPUT}
            type="email"
            value={pessoa.email}
          />
        </Campo>
        <Campo
          hint="separadas por vírgula — quase todo mundo faz mais de uma"
          htmlFor="p-hab"
          label="Habilidades"
        >
          <input
            id="p-hab"
            onChange={(e) =>
              setPessoa((p) => ({ ...p, habilidades: e.target.value }))
            }
            placeholder="frontend, backend, dados"
            style={INPUT}
            value={pessoa.habilidades}
          />
        </Campo>
        <Campo
          hint="já sem overhead interno"
          htmlFor="p-horas"
          label="Horas faturáveis/semana"
        >
          <input
            id="p-horas"
            onChange={(e) =>
              setPessoa((p) => ({ ...p, horas: e.target.value }))
            }
            style={INPUT}
            type="number"
            value={pessoa.horas}
          />
        </Campo>
        <Campo htmlFor="p-entra" label="Entra em">
          <input
            id="p-entra"
            onChange={(e) =>
              setPessoa((p) => ({ ...p, entraEm: e.target.value }))
            }
            style={INPUT}
            type="date"
            value={pessoa.entraEm}
          />
        </Campo>
        {tipo === "terceiro" ? (
          <Campo htmlFor="p-sai" label="Sai em">
            <input
              id="p-sai"
              onChange={(e) =>
                setPessoa((p) => ({ ...p, saiEm: e.target.value }))
              }
              style={INPUT}
              type="date"
              value={pessoa.saiEm}
            />
          </Campo>
        ) : null}
        <Campo
          hint="aparece na linha da pessoa"
          htmlFor="p-obs"
          label="Observação"
        >
          <input
            id="p-obs"
            onChange={(e) =>
              setPessoa((p) => ({ ...p, observacao: e.target.value }))
            }
            placeholder="ex. metade do tempo em gestão"
            style={INPUT}
            value={pessoa.observacao}
          />
        </Campo>
      </div>

      {tipo === "terceiro" ? (
        <FaixaDaJanela
          entraEm={pessoa.entraEm}
          horasSemana={Number(pessoa.horas) || 40}
          saiEm={pessoa.saiEm}
        />
      ) : null}

      <div>
        <BotaoPrimario
          disabled={!podeCadastrar || pendente}
          full={false}
          type="submit"
        >
          {rotuloDeCadastrar(tipo, pendente)}
        </BotaoPrimario>
      </div>
    </form>
  );
}

function rotuloDeCadastrar(tipo: Tipo, pendente: boolean): string {
  if (pendente) {
    return tipo === "terceiro" ? "Adicionando…" : "Cadastrando…";
  }
  return tipo === "terceiro" ? "Adicionar ao plano" : "Cadastrar";
}
