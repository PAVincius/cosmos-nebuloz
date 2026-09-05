"use client";

// base.tsx — primitivas do Scaffold.
//
// Mesmo arranjo do Meridian, pelo mesmo motivo: o que já existe é reusado tal e
// qual, em duas camadas.
//
//   1. `@repo/design-system/cosmos/kit` — Button, Badge, Card, SectionCard,
//      KpiCard, Progress, PageHeader, Avatar, Skel, SkeletonKpi, IconButton.
//      Importe direto do kit nas telas; não há motivo para passar por aqui.
//   2. `components/charter/base` — Eyebrow, MetaCell, FilterChips, Legend,
//      BarRow, TableHead, TableRow, SmartEmptyState e companhia. São exatamente
//      as primitivas do `charter-base.jsx` do handoff, que o `scaffold.html`
//      também importa — o protótipo do Scaffold carrega o mesmo arquivo.
//
// Este módulo é o ÚNICO ponto de acoplamento do Scaffold com o Charter. Quando
// aparecer o quarto consumidor, `charter/base.tsx` migra para um diretório
// compartilhado e só três arquivos como este mudam de import.
//
// As primitivas dependem de nomes de classe (.btn, .lift, .navitem, .skeleton,
// .scroll) definidos sob a raiz de cada módulo — por isso `scaffold.css` existe
// e por isso a casca do Scaffold marca `.scaffold-root`.

// biome-ignore lint/performance/noBarrelFile: ponto único e deliberado de acoplamento com o Charter — ver comentário acima
export {
  BackLink,
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
export {
  type ScreenState,
  useCharterData as useScaffoldData,
} from "@/components/charter/use-charter-data";
