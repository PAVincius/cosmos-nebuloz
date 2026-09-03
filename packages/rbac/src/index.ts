// Charter — governança de IA
export type { CharterPermission } from "./charter-matrix";
export {
  CHARTER_MATRIX,
  CHARTER_PERMISSION_LABEL,
  CHARTER_PERMISSIONS,
  CHARTER_ROLE_LABEL,
  CHARTER_ROLE_TONE,
  denialReason,
  hasCharterPermission,
  rolesGranting,
} from "./charter-matrix";
export { getCharterRole, invalidateCharterRoleCache } from "./charter-resolve";
export type { Permission, SaFeRole } from "./matrix";
export { hasPermission, hasPermissions, PERMISSION_MATRIX } from "./matrix";
// Meridian — diagnóstico de prontidão para IA
export type { MeridianPermission } from "./meridian-matrix";
export {
  hasMeridianPermission,
  MERIDIAN_MATRIX,
  MERIDIAN_PERMISSION_LABEL,
  MERIDIAN_PERMISSIONS,
  MERIDIAN_ROLE_LABEL,
  MERIDIAN_ROLE_TONE,
  meridianDenialReason,
  meridianRolesGranting,
} from "./meridian-matrix";
export {
  getMeridianRole,
  invalidateMeridianRoleCache,
} from "./meridian-resolve";
// Contratação modular — Cosmos / Charter / Signal / Meridian
export { hasModule, invalidateModuleCache, listModules } from "./modules";
export { getEffectiveRole, invalidatePermissionCache } from "./resolve";
// Signal — medição de adoção e valor de iniciativas de IA
export type { SignalPermission } from "./signal-matrix";
export {
  hasSignalPermission,
  ownsOrOutranksInitiative,
  SIGNAL_MATRIX,
  SIGNAL_PERMISSION_LABEL,
  SIGNAL_PERMISSIONS,
  SIGNAL_ROLE_LABEL,
  SIGNAL_ROLE_TONE,
  signalDenialReason,
  signalRolesGranting,
} from "./signal-matrix";
export { getSignalRole, invalidateSignalRoleCache } from "./signal-resolve";
