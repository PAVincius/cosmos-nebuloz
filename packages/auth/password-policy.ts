/**
 * Única fonte do tamanho mínimo de senha (SOC2 CC6). Sem "server-only" — é
 * lido tanto pelo better-auth (`server.ts`) quanto pelos formulários client
 * (`components/reset-password.tsx`, `apps/app/.../security-form.tsx`), que
 * antes anunciavam "mínimo 8" enquanto o servidor exigia 12: a pessoa
 * digitava 8-11 caracteres, via `minLength` deixar passar, e só descobria a
 * regra de verdade no erro do servidor.
 */
export const MIN_PASSWORD_LENGTH = 12;
