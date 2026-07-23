// use-action-toast.ts — thin toast.promise-style wrapper around a Result<T>
// server-action call (RF-95). Shows a loading toast, then replaces it in
// place (same id, no stacking) with a success or error toast once the
// action settles. Always returns the original Result<T> so callers keep
// their existing control flow (optimistic updates, reverts, etc.).
import { toast } from "sonner";
import type { Result } from "../../app/actions/_base";

type ActionToastOptions<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error?: string | ((err: string) => string);
};

export async function useActionToast<T>(
  action: () => Promise<Result<T>>,
  opts: ActionToastOptions<T>
): Promise<Result<T>> {
  const id = toast.loading(opts.loading);
  const res = await action();

  if (res.ok) {
    const message =
      typeof opts.success === "function"
        ? opts.success(res.data)
        : opts.success;
    toast.success(message, { id });
  } else {
    const message = opts.error
      ? typeof opts.error === "function"
        ? opts.error(res.error)
        : opts.error
      : res.error;
    toast.error(message, { id });
  }

  return res;
}
