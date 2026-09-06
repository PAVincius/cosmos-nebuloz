import type { ProductModule } from "@repo/database";
import { Badge } from "@repo/design-system/cosmos/kit";
import type { LeadRow } from "@/app/actions/leads";
import { Celula, Tabela, TableHead } from "@/components/tabela";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  type ConfigEstagio,
  diasNoEstagio,
  ESTAGIOS,
  type Estagio,
  estagnado,
  INFO_ESTAGIO,
  MOTIVOS_PERDA,
  type MotivoPerda,
  PORTAS,
  paraLeadFunil,
  valorDoLead,
} from "@/lib/comercial/funil";

/**
 * Tabela de leads (spec §4, colunas do design). Ordena estagnados primeiro —
 * é o que precisa de atenção agora — e dentro disso pelo estágio mais
 * avançado, porque um lead perto do fim que travou custa mais do que um lead
 * novo travado no início.
 */

function ordemDeEstagio(codigo: string): number {
  const i = ESTAGIOS.indexOf(codigo as Estagio);
  return i === -1 ? 0 : i;
}

function compararLeads(
  a: LeadRow,
  b: LeadRow,
  estagios: ConfigEstagio[],
  hoje: Date
): number {
  const aVencido = estagnado(paraLeadFunil(a), estagios, hoje);
  const bVencido = estagnado(paraLeadFunil(b), estagios, hoje);
  if (aVencido !== bVencido) {
    return aVencido ? -1 : 1;
  }
  return ordemDeEstagio(b.estagio) - ordemDeEstagio(a.estagio);
}

const LARGURAS = [
  { id: "org", largura: "24%" },
  { id: "entrada", largura: "20%" },
  { id: "estagio", largura: "14%" },
  { id: "valor", largura: "12%" },
  { id: "passo", largura: "18%" },
  { id: "tempo", largura: "12%" },
];

function textoEntradaOrigem(l: LeadRow): string {
  const porta = l.entrada ? PORTAS[l.entrada as ProductModule] : undefined;
  const entradaTexto = porta ? `${porta.degrau} ${porta.rotulo}` : "—";
  const canalTexto = l.canal?.nome ?? l.origem ?? "—";
  return `${entradaTexto} · ${canalTexto}`;
}

function EstagioBadge({ lead }: { lead: LeadRow }) {
  if (lead.situacao === "GANHO") {
    return <Badge tone="green">Ganho</Badge>;
  }
  if (lead.situacao === "PERDIDO") {
    const codigo = (lead.perdidoNoEstagio ?? lead.estagio) as Estagio;
    const curto = INFO_ESTAGIO[codigo]?.curto ?? codigo;
    return <Badge tone="red">Perdido · {curto}</Badge>;
  }
  const info = INFO_ESTAGIO[lead.estagio as Estagio];
  return (
    <Badge tone={info?.tom ?? "neutral"}>{info?.rotulo ?? lead.estagio}</Badge>
  );
}

function TextoProximoPasso({
  lead,
  vencido,
}: {
  lead: LeadRow;
  vencido: boolean;
}) {
  if (lead.situacao === "GANHO") {
    return <span>Tenant {lead.proposta?.tenantProvisionadoSlug ?? "—"}</span>;
  }
  if (lead.situacao === "PERDIDO") {
    const codigo = lead.motivoPerda as MotivoPerda | null;
    return <span>{codigo ? MOTIVOS_PERDA[codigo] : "—"}</span>;
  }
  if (lead.estagio === "PROPOSAL") {
    return <span>Lê a proposta</span>;
  }
  if (!lead.proximaAcao) {
    return (
      <span style={{ color: "var(--amber-text)", fontWeight: 700 }}>
        Sem próximo passo
      </span>
    );
  }
  const dataTexto = lead.proximaAcaoEm
    ? ` — ${new Date(lead.proximaAcaoEm).toLocaleDateString("pt-BR")}`
    : "";
  return (
    <span style={{ color: vencido ? "var(--red-text)" : "var(--ink-muted)" }}>
      {lead.proximaAcao}
      {dataTexto}
    </span>
  );
}

function TempoCelula({
  lead,
  dias,
  vencido,
}: {
  lead: LeadRow;
  dias: number;
  vencido: boolean;
}) {
  if (lead.situacao === "PERDIDO") {
    const texto = lead.perdidoEm
      ? new Date(lead.perdidoEm).toLocaleDateString("pt-BR")
      : "—";
    return <span className="mono">{texto}</span>;
  }
  if (lead.situacao === "GANHO") {
    return (
      <span className="mono">
        {new Date(lead.estagioDesde).toLocaleDateString("pt-BR")}
      </span>
    );
  }
  return (
    <span
      className="mono"
      style={{
        color: vencido ? "var(--red-text)" : "var(--ink-muted)",
        fontWeight: vencido ? 800 : 600,
      }}
    >
      {dias} d
    </span>
  );
}

function LinhaLead({
  lead,
  estagios,
  hoje,
  onAbrirLead,
}: {
  lead: LeadRow;
  estagios: ConfigEstagio[];
  hoje: Date;
  onAbrirLead: (id: string) => void;
}) {
  const leadFunil = paraLeadFunil(lead);
  const vencido = estagnado(leadFunil, estagios, hoje);
  const dias = diasNoEstagio(lead.estagioDesde, hoje);
  const valor = valorDoLead(leadFunil);
  const contato =
    [lead.contatoNome, lead.contatoEmail].filter(Boolean).join(" · ") ||
    "sem contato registrado";

  return (
    // A linha inteira é conveniência de clique; o botão do nome dentro dela já
    // cobre teclado e leitor de tela (useKeyWithClickEvents está off no biome).
    <tr onClick={() => onAbrirLead(lead.id)} style={{ cursor: "pointer" }}>
      <Celula>
        <button
          aria-label={`Abrir lead ${lead.nome}`}
          className="btn"
          onClick={(e) => {
            e.stopPropagation();
            onAbrirLead(lead.id);
          }}
          style={{
            display: "block",
            background: "none",
            border: "none",
            padding: 0,
            font: "inherit",
            fontWeight: 700,
            color: "var(--ink)",
            cursor: "pointer",
            textAlign: "left",
          }}
          type="button"
        >
          <span
            className="mono"
            style={{
              color: "var(--ink-faint)",
              fontWeight: 600,
              marginRight: 6,
            }}
          >
            {lead.id.slice(0, 8)}
          </span>
          {lead.nome}
        </button>
        <div style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
          {contato}
        </div>
      </Celula>
      <Celula>{textoEntradaOrigem(lead)}</Celula>
      <Celula>
        <EstagioBadge lead={lead} />
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        <span className="mono">{valor > 0 ? formatarBRL(valor) : "—"}</span>
      </Celula>
      <Celula>
        <TextoProximoPasso lead={lead} vencido={vencido} />
      </Celula>
      <Celula>
        <TempoCelula dias={dias} lead={lead} vencido={vencido} />
      </Celula>
    </tr>
  );
}

export function TabelaLeads({
  leads,
  estagios,
  hoje,
  onAbrirLead,
}: {
  leads: LeadRow[];
  estagios: ConfigEstagio[];
  hoje: Date;
  onAbrirLead: (id: string) => void;
}) {
  const ordenados = [...leads].sort((a, b) =>
    compararLeads(a, b, estagios, hoje)
  );

  if (ordenados.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          padding: 28,
          textAlign: "center",
          fontSize: "var(--fs-base)",
          color: "var(--ink-muted)",
        }}
      >
        Nenhum lead neste filtro.
      </p>
    );
  }

  return (
    <Tabela larguras={LARGURAS}>
      <TableHead
        labels={[
          "Organização",
          "Entrada · origem",
          "Estágio",
          "Valor",
          "Próximo passo",
          "Tempo",
        ]}
      />
      <tbody>
        {ordenados.map((l) => (
          <LinhaLead
            estagios={estagios}
            hoje={hoje}
            key={l.id}
            lead={l}
            onAbrirLead={onAbrirLead}
          />
        ))}
      </tbody>
    </Tabela>
  );
}
