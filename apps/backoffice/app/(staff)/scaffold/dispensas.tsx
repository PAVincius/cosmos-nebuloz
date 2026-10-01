import { Badge } from "@repo/design-system/cosmos/kit";
import type {
  DispensaRow,
  DispensasResult,
  DispensaVia,
} from "@/app/actions/scaffold-dispensas";
import { Secao } from "@/components/secao";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { Vazio } from "@/components/vazio";
import { formatarDataHora } from "@/lib/data";

// Dispensa visível (specs/017, FR-005/FR-006). Só leitura: a consultora dispensa
// e reverte no app do cliente, e esta tela só mostra o que ficou dispensado e
// por quê. Entregável dispensado não some; é o que impede o gate de virar
// formalidade em silêncio.

/** Palavra e tom por via. A manual é a única decisão de pessoa, então é a que
 *  pede um segundo olhar (âmbar); o estado nunca é só a cor. */
const VIA: Record<
  DispensaVia,
  { rotulo: string; tom: "neutral" | "blue" | "amber" }
> = {
  automatica: { rotulo: "Automática", tom: "neutral" },
  overlay: { rotulo: "Overlay", tom: "blue" },
  manual: { rotulo: "Manual", tom: "amber" },
};

const LARGURAS = [
  { id: "org", largura: "150px" },
  { id: "trilha", largura: "96px" },
  { id: "entregavel", largura: "200px" },
  { id: "via", largura: "112px" },
  { id: "motivo", largura: "auto" },
  { id: "quando", largura: "170px" },
];

const LEGENDA =
  "Automática: regra do template, como módulo não contratado. Overlay: customização do cliente. Manual: decisão da consultora numa trilha.";

function Linha({ d }: { d: DispensaRow }) {
  const via = VIA[d.via];
  return (
    <TableRow>
      <Celula>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>
          {d.orgName}
        </span>
      </Celula>
      <Celula>
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            color: "var(--accent-text)",
          }}
        >
          {d.trackCode}
        </span>
      </Celula>
      <Celula>
        <span
          className="mono"
          style={{ fontSize: "var(--fs-nota)", color: "var(--ink-subtle)" }}
        >
          {d.code}
        </span>
        <span style={{ display: "block", overflowWrap: "anywhere" }}>
          {d.title}
        </span>
      </Celula>
      <Celula>
        <Badge tone={via.tom}>{via.rotulo}</Badge>
      </Celula>
      <Celula>
        <span
          style={{
            color: "var(--ink-muted)",
            lineHeight: 1.5,
            overflowWrap: "anywhere",
          }}
        >
          {d.reason}
        </span>
      </Celula>
      <Celula>
        <span style={{ display: "block", fontWeight: 600 }}>{d.by}</span>
        <span
          className="mono"
          style={{ fontSize: "var(--fs-nota)", color: "var(--ink-subtle)" }}
        >
          {formatarDataHora(d.at)}
        </span>
      </Celula>
    </TableRow>
  );
}

export function DispensasDaCarteira({ dados }: { dados: DispensasResult }) {
  return (
    <Secao
      action={<Badge tone="neutral">{dados.items.length}</Badge>}
      bodyStyle={{ padding: dados.items.length === 0 ? undefined : 0 }}
      icon="shield"
      subtitle={`Entregáveis fora do gate, de todas as trilhas, com o motivo. Somente leitura. ${LEGENDA}`}
      title="Entregáveis dispensados"
    >
      {dados.items.length === 0 ? (
        <Vazio>
          Nenhum entregável dispensado em trilha de cliente. Quando uma regra do
          template, um overlay ou uma consultora dispensar um, ele aparece aqui
          com o motivo.
        </Vazio>
      ) : (
        <>
          <Tabela larguras={LARGURAS}>
            <TableHead
              labels={[
                "Cliente",
                "Trilha",
                "Entregável",
                "Via",
                "Motivo",
                "Quem e quando",
              ]}
            />
            <tbody>
              {dados.items.map((d) => (
                <Linha d={d} key={d.id} />
              ))}
            </tbody>
          </Tabela>
          {dados.truncated ? (
            <p
              style={{
                margin: 0,
                padding: "10px 16px",
                fontSize: "var(--fs-nota)",
                color: "var(--ink-subtle)",
              }}
            >
              Mostrando os {dados.items.length} mais recentes. Há mais dispensas
              além deste teto.
            </p>
          ) : null}
        </>
      )}
    </Secao>
  );
}
