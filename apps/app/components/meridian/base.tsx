"use client";

// base.tsx — primitivas do Meridian.
//
// O que já existe é reusado tal e qual, em duas camadas:
//
//   1. `@repo/design-system/cosmos/kit` — Button, Badge, Card, SectionCard,
//      KpiCard, Progress, PageHeader, Tabs, Avatar, Skel, IconButton. Importe
//      direto do kit nas telas; não há motivo para passar por aqui.
//   2. `components/charter/base` — Eyebrow, MetaCell, FilterChips, Legend,
//      TableHead, TableRow, SmartEmptyState, Field/Input/Select e companhia.
//      São exatamente as primitivas do `charter-base.jsx` do handoff, que o
//      Meridian também consome (o `meridian.html` importa o mesmo arquivo).
//
// Este módulo é o ÚNICO ponto de acoplamento com o Charter, e existe para que
// esse acoplamento seja visível e barato de desfazer: quando aparecer um
// terceiro consumidor, `charter/base.tsx` migra para um diretório compartilhado
// e só este arquivo muda de import. Reexportar aqui custa uma linha; mover
// agora custaria tocar os imports de doze telas do Charter para ganhar
// organização, não comportamento.
//
// As primitivas dependem de nomes de classe (.btn, .lift, .navitem, .skeleton)
// definidos sob a raiz de cada módulo — por isso `meridian.css` existe e por
// isso a casca do Meridian marca `.meridian-root`.

import type { ReactNode } from "react";
import { ModalProvider as CharterModalProvider } from "@/components/charter/modal";

// biome-ignore lint/performance/noBarrelFile: ponto único e deliberado de acoplamento com o Charter — ver comentário acima
export { BackLink } from "@/components/charter/back-link";
export {
  BarRow,
  type ChipOption,
  type ColumnLabel,
  Eyebrow,
  Field,
  FilterChips,
  GatedButton,
  Input,
  Legend,
  type LegendItem,
  MetaCell,
  ScreenError,
  Segmented,
  Select,
  SkeletonCard,
  SkeletonRows,
  SmartEmptyState,
  StatusDot,
  type TabDef,
  TableHead,
  TableRow,
  Tabs,
  Textarea,
  useFieldId,
  useScreenLoad,
} from "@/components/charter/base";
// `useDirty` já é consumido por cosmos/meridian/scaffold/signal (comentário de
// `form-kit.tsx`) — não é reexport novo de escopo, só o primeiro uso no
// Meridian. Marca o `ModalHost` como sujo pra Esc/clique-fora perguntarem
// antes de fechar, em vez de fechar direto (mesmo mecanismo do Charter).
export { useDirty } from "@/components/charter/form-kit";
export { ModalShell, useModal } from "@/components/charter/modal";
// Busca de tela com os três estados obrigatórios (loading / vazio / erro) e o
// host de modal. Mesma razão do reexport acima — o Charter chegou primeiro, o
// comportamento é idêntico, e uma segunda cópia seria um segundo lugar para
// corrigir o mesmo bug.
export {
  type ScreenState,
  useCharterData as useMeridianData,
} from "@/components/charter/use-charter-data";

/** O modal sai da árvore (portal em <body>) e perde o `.meridian-root`, onde
 *  vivem `--accent`, os anéis de foco e as classes `.btn`. Sem o escopo, o
 *  Badge de tom accent caía na cor herdada (contraste 1,1:1). */
export function ModalProvider({ children }: { children: ReactNode }) {
  return (
    <CharterModalProvider scopeClassName="meridian-root">
      {children}
    </CharterModalProvider>
  );
}
