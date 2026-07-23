import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CommandPalette } from "../../components/cosmos/command-palette";
import { NavCtx } from "../../components/cosmos/kit";

// jsdom has no ResizeObserver; cmdk's Command.List uses one internally.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
// jsdom has no scrollIntoView; cmdk scrolls the selected item into view.
if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

const PLACEHOLDER = "Buscar tela...";

function pressCmdK() {
  fireEvent.keyDown(document, { key: "k", metaKey: true });
}

describe("CommandPalette", () => {
  test("is closed by default", () => {
    render(<CommandPalette />);
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  test("opens on Cmd+K", () => {
    render(<CommandPalette />);
    pressCmdK();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeNull();
  });

  test("opens on Ctrl+K", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeNull();
  });

  test("Cmd+K toggles the palette closed again", () => {
    render(<CommandPalette />);
    pressCmdK();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeNull();
    pressCmdK();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  test("typing filters NAV entries by label", () => {
    render(<CommandPalette />);
    pressCmdK();
    expect(screen.queryByText("WSJF Rankings")).not.toBeNull();
    expect(screen.queryByText("Program Board")).not.toBeNull();

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "WSJF" } });

    expect(screen.queryByText("WSJF Rankings")).not.toBeNull();
    expect(screen.queryByText("Program Board")).toBeNull();
  });

  test("shows an empty state when nothing matches", () => {
    render(<CommandPalette />);
    pressCmdK();
    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "zzz-no-match-zzz" } });
    expect(screen.queryByText("Nenhum resultado")).not.toBeNull();
  });

  test("closes on Escape", () => {
    render(<CommandPalette />);
    pressCmdK();
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });

  test("selecting an entry navigates and closes the palette", () => {
    const navigate = vi.fn();
    render(
      <NavCtx.Provider value={{ navigate }}>
        <CommandPalette />
      </NavCtx.Provider>
    );
    pressCmdK();
    fireEvent.click(screen.getByText("WSJF Rankings"));

    expect(navigate).toHaveBeenCalledWith("wsjf");
    expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
  });
});
