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
// Contratação modular — Cosmos / Charter / Signal
export { hasModule, invalidateModuleCache, listModules } from "./modules";
export { getEffectiveRole, invalidatePermissionCache } from "./resolve";
