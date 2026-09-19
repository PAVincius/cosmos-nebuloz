"use client";

// base.tsx — primitivas do Signal.
//
// O que já existe é reusado tal e qual, em duas camadas:
//
//   1. `@repo/design-system/cosmos/kit` — Button, Badge, Card, SectionCard,
//      KpiCard, Progress, PageHeader, Tabs, Avatar, Skel, IconButton. Importe
//      direto do kit nas telas; não há motivo para passar por aqui.
//   2. `components/charter/base` — Eyebrow, MetaCell, FilterChips, Legend,
//      TableHead, TableRow, SmartEmptyState, Field/Input/Select e companhia.
//      São as primitivas do `charter-base.jsx` do handoff, que o `signal.html`
//      também importa — literalmente o mesmo arquivo.
//
// Este módulo é o ÚNICO ponto de acoplamento com o Charter, seguindo o que o
// Meridian já fez. Reexportar aqui custa uma linha; mover `charter/base.tsx`
// para um diretório compartilhado agora custaria tocar os imports de doze telas
// do Charter e das do Meridian para ganhar organização, não comportamento.
//
// As primitivas dependem de nomes de classe (.btn, .lift, .navitem, .skeleton)
// definidos sob a raiz de cada módulo — por isso `signal.css` existe e por isso
// a casca do Signal marca `.signal-root`.

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
export {
  ModalProvider,
  ModalShell,
  useModal,
} from "@/components/charter/modal";
// Busca de tela com os três estados obrigatórios (loading / vazio / erro) e o
// host de modal. Mesma razão do reexport acima — o Charter chegou primeiro, o
// comportamento é idêntico, e uma segunda cópia seria um segundo lugar para
// corrigir o mesmo bug.
export {
  type ScreenState,
  useCharterData as useSignalData,
} from "@/components/charter/use-charter-data";
