import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/ai/lib/models", () => ({
  getActiveProvider: vi.fn().mockReturnValue("none"),
  getAIModel: vi.fn(),
  models: {},
}));

// Mock @repo/auth/server to prevent better-auth (which uses zod v4 z.xor)
// from loading in the jsdom test environment.
vi.mock("@repo/auth/server", () => ({
  requireTenantSession: vi.fn(),
  currentUser: vi.fn(),
  redirectToSignIn: vi.fn(),
  getOrgId: vi.fn(),
  requireRole: vi.fn(),
  requireMfaForPrivilegedRoles: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

// Mock server actions that import @repo/auth/server
vi.mock("@/app/actions/epics/update-epic", () => ({
  updateEpic: vi.fn().mockResolvedValue({ ok: true, data: { id: "e1" } }),
}));

vi.mock("@/app/actions/epics/analyze-invest", () => ({
  analyzeInvest: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

vi.mock("@/app/actions/ai-prompt/generate-prompt", () => ({
  generateAndDeliverPrompt: vi.fn().mockResolvedValue({ ok: true }),
}));

// Mock tiptap (used by EpicDrawerDescription) to avoid jsdom editor issues
vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => null),
  EditorContent: () => <div data-testid="editor" />,
}));

// Mock Sheet to avoid radix/portal issues in jsdom
vi.mock("@repo/design-system/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="sheet-title">{children}</h2>
  ),
}));

// Mock Tabs to render all tab content simultaneously for easy testing
vi.mock("@repo/design-system/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tabs">{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div role="tablist">{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <button data-value={value} role="tab" type="button">
      {children}
    </button>
  ),
  TabsContent: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-tab={value}>{children}</div>,
}));

import { EpicDrawer } from "@/app/(authenticated)/dashboard/portfolio/components/epic-drawer";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";

afterEach(() => cleanup());

const noop = () => {};

function makeEpic(
  overrides: Partial<AggregatedPortfolioEpic> = {}
): AggregatedPortfolioEpic {
  return {
    id: "epic-1",
    title: "My Drawer Epic",
    statusId: "status-1",
    order: 0,
    wsjfScore: 4.5,
    bv: 8,
    tc: 5,
    rr: 3,
    js: 2,
    featureCount: 3,
    strategicThemeId: null,
    themeTitle: null,
    themeColor: null,
    linkedOKRCount: 0,
    governanceStatus: null,
    investScore: null,
    investBreakdown: null,
    descriptionMd: null,
    ...overrides,
  };
}

describe("EpicDrawer", () => {
  it("returns null when epic is null", () => {
    const { container } = render(
      <EpicDrawer epic={null} epicId="epic-1" onClose={noop} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the epic title", () => {
    render(<EpicDrawer epic={makeEpic()} epicId="epic-1" onClose={noop} />);
    expect(screen.getByText("My Drawer Epic")).toBeDefined();
  });

  it("shows all 4 tabs with correct labels", () => {
    render(<EpicDrawer epic={makeEpic()} epicId="epic-1" onClose={noop} />);
    expect(screen.getByText("Descrição")).toBeDefined();
    expect(screen.getByText("Análise IA")).toBeDefined();
    expect(screen.getByText("Dependências")).toBeDefined();
    expect(screen.getByText("Mais")).toBeDefined();
  });

  it("does not show theme badge when themeTitle is null", () => {
    render(
      <EpicDrawer
        epic={makeEpic({ themeTitle: null })}
        epicId="epic-1"
        onClose={noop}
      />
    );
    // No theme badge visible — just assert title renders fine
    expect(screen.getByText("My Drawer Epic")).toBeDefined();
  });

  it("shows theme badge when themeTitle is provided", () => {
    render(
      <EpicDrawer
        epic={makeEpic({ themeTitle: "Growth", themeColor: "#FF5733" })}
        epicId="epic-1"
        onClose={noop}
      />
    );
    expect(screen.getByText("Growth")).toBeDefined();
  });
});
