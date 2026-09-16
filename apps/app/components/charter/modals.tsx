// modals.tsx — barrel transitório dos modais do Charter.
//
// Cada modal vive em `./modals/<nome>.tsx` desde que este arquivo passou de
// 1700 linhas. Aqui só há re-exports, para que os nove importadores
// (`./modals` e `../modals`) não mudem nesta onda; inlinar o import em cada
// caller é follow-up de uma linha por arquivo, e aí este barrel some.
// O IntakeModal (FR-4) continua em `modals-intake.tsx`.

// biome-ignore lint/performance/noBarrelFile: reexport intencional e transitório — ver cabeçalho
export { type DataClass, GatedAction } from "./modals/_shared";
export { ClauseLibraryModal } from "./modals/clause-library";
export { DecisionModal, type DecisionSubmit } from "./modals/decision";
export { DiffModal } from "./modals/diff";
export { ExportPackageModal } from "./modals/export-package";
export { MitigationModal } from "./modals/mitigation";
export { NewVendorModal } from "./modals/new-vendor";
export { PublishTrackModal } from "./modals/publish-track";
export { PublishVersionModal } from "./modals/publish-version";
export { VendorTierModal } from "./modals/vendor-tier";
