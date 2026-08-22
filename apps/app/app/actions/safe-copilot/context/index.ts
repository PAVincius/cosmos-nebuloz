import { buildARTsContext } from "./arts";
import { buildFlowMetricsContext } from "./flow-metrics";
import { buildLeanBudgetContext } from "./lean-budget";
import { buildPIWorkspaceContext } from "./pi-workspace";
import { buildPortfolioContext } from "./portfolio";
import { buildWsjfContext } from "./wsjf";

export type CopilotContext = {
  mode: string;
  surface: string;
  piWorkspace?: Awaited<ReturnType<typeof buildPIWorkspaceContext>>;
  flowMetrics?: Awaited<ReturnType<typeof buildFlowMetricsContext>>;
  leanBudget?: Awaited<ReturnType<typeof buildLeanBudgetContext>>;
  portfolio?: Awaited<ReturnType<typeof buildPortfolioContext>>;
  wsjf?: Awaited<ReturnType<typeof buildWsjfContext>>;
  arts?: Awaited<ReturnType<typeof buildARTsContext>>;
};

export async function buildCopilotContext(
  tenantId: string,
  mode: string,
  surface: string,
  contextRef: Record<string, string>
): Promise<CopilotContext> {
  const ctx: CopilotContext = { mode, surface };

  const loaders: Promise<void>[] = [];

  if (surface === "pi_workspace" || mode === "rte") {
    loaders.push(
      buildPIWorkspaceContext(tenantId, {
        artId: contextRef.artId,
        piId: contextRef.piId,
      }).then((data) => {
        ctx.piWorkspace = data;
      })
    );
  }

  if (surface === "flow_dashboard" || mode === "spc") {
    loaders.push(
      buildFlowMetricsContext(tenantId, {
        scopeId: contextRef.scopeId,
        scope: contextRef.scope,
      }).then((data) => {
        ctx.flowMetrics = data;
      })
    );
  }

  if (surface === "lean_budget" || mode === "lpm") {
    loaders.push(
      buildLeanBudgetContext(tenantId, { vsId: contextRef.vsId }).then(
        (data) => {
          ctx.leanBudget = data;
        }
      )
    );
  }

  if (
    surface === "portfolio_dashboard" ||
    surface === "global" ||
    mode === "pm"
  ) {
    loaders.push(
      buildPortfolioContext(tenantId).then((data) => {
        ctx.portfolio = data;
      })
    );
  }

  // global mode: load portfolio + flow summary
  if (mode === "global" && !ctx.flowMetrics) {
    loaders.push(
      buildFlowMetricsContext(tenantId, {}).then((data) => {
        ctx.flowMetrics = data;
      })
    );
  }

  // WSJF context: load for pm, rte, and global modes — drives prioritization suggestions
  if (mode === "pm" || mode === "rte" || mode === "global") {
    loaders.push(
      buildWsjfContext(tenantId, {
        artId: contextRef.artId,
        piId: contextRef.piId,
      }).then((data) => {
        ctx.wsjf = data;
      })
    );
  }

  // ARTs context: load for global and rte — enables ART comparison ("which ART is underperforming?")
  if (mode === "global" || mode === "rte") {
    loaders.push(
      buildARTsContext(tenantId).then((data) => {
        ctx.arts = data;
      })
    );
  }

  await Promise.all(loaders);
  return ctx;
}
