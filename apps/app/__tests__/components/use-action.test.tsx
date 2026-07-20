import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAction } from "../../components/cosmos/kit";

describe("useAction", () => {
  it("resolves data on success", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: ["x"] });
    const { result } = renderHook(() => useAction(action));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["x"]);
    expect(result.current.error).toBe(false);
  });

  it("sets error on !ok, without setting data", async () => {
    const action = vi.fn().mockResolvedValue({ ok: false, error: "boom" });
    const { result } = renderHook(() => useAction(action));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
