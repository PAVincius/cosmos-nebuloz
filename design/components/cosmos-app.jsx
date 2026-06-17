// cosmos-app.jsx — theme state, router, tweaks, mounts shell + screens.

const ACCENTS = {
  "#5e6ad2": { name: "Lavender", dark: "#7c87ff" },
  "#2563eb": { name: "Azul", dark: "#60a5fa" },
  "#0d9488": { name: "Esmeralda", dark: "#2dd4bf" },
  "#7c3aed": { name: "Violeta", dark: "#a78bfa" },
};
const hexToRgb = (h) => {
  const n = parseInt(h.replace("#", ""), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#5e6ad2",
  "fx": 1,
  "ecg": true,
  "density": "regular"
}/*EDITMODE-END*/;

const DENSITY = { compact: { pad: 16, gap: 12 }, regular: { pad: 20, gap: 16 }, comfy: { pad: 24, gap: 20 } };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState("dashboard");
  const theme = t.theme === "dark" ? "dark" : "light";

  const accentKey = ACCENTS[t.accent] ? t.accent : "#5e6ad2";
  const accentHex = theme === "dark" ? ACCENTS[accentKey].dark : accentKey;
  const dens = DENSITY[t.density] || DENSITY.regular;

  React.useEffect(() => {
    document.body.style.background = "var(--canvas)";
  }, []);

  const rootStyle = {
    "--accent": accentHex,
    "--accent-rgb": hexToRgb(accentHex),
    "--fx": String(t.fx),
    "--pad": dens.pad + "px",
    "--gap": dens.gap + "px",
    height: "100%", display: "flex", overflow: "hidden",
  };

  const screens = {
    dashboard: DashboardScreen, kanban: KanbanScreen, wsjf: WsjfScreen,
    program: ProgramBoardScreen, piplanning: PiPlanningScreen, flow: FlowScreen,
    themes: ThemesScreen, okrs: OkrsScreen, budgets: BudgetsScreen, roadmap: RoadmapScreen,
    anomalies: AnomaliesScreen, dependencies: DependenciesScreen, risks: RisksScreen,
    teams: TeamsScreen, velocity: VelocityScreen, measure: MeasureScreen,
    strategy: StrategyScreen, tags: TagsScreen, governance: GovernanceScreen, decisions: DecisionsScreen,
    solution: SolutionScreen, workflows: WorkflowsScreen, integrations: IntegrationsScreen,
    webhooks: WebhooksScreen, settings: SettingsScreen, copilot: CopilotScreen,
  };
  const ScreenComp = screens[screen];

  return (
    <ThemeCtx.Provider value={theme}>
      <div data-theme={theme} className={t.ecg ? "" : "no-ecg"} style={rootStyle}>
        <Sidebar active={screen} onNavigate={setScreen} />
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%" }}>
          <Topbar active={screen} theme={theme} onToggleTheme={() => setTweak("theme", theme === "dark" ? "light" : "dark")} />
          <div className="scroll" key={screen} style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", padding: "24px 28px 40px" }}>
            {ScreenComp ? <ScreenComp /> : <ComingSoon active={screen} />}
          </div>
        </main>

        <TweaksPanel>
          <TweakSection label="Tema" />
          <TweakRadio label="Modo" value={t.theme} options={["light", "dark"]} onChange={(v) => setTweak("theme", v)} />
          <TweakColor label="Accent" value={accentKey} options={Object.keys(ACCENTS)} onChange={(v) => setTweak("accent", v)} />

          <TweakSection label="Pegada tecno-UI (escuro)" />
          <TweakSlider label="Intensidade dos efeitos" value={t.fx} min={0} max={1.6} step={0.1} onChange={(v) => setTweak("fx", v)} />
          <TweakToggle label="Sinal ECG (linha viva)" value={t.ecg} onChange={(v) => setTweak("ecg", v)} />

          <TweakSection label="Layout" />
          <TweakRadio label="Densidade" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />

          <TweakSection label="Ir para tela" />
          <TweakSelect label="Tela" value={screen} options={["dashboard", "kanban", "wsjf", "themes", "strategy", "okrs", "budgets", "tags", "anomalies", "roadmap", "governance", "decisions", "teams", "program", "piplanning", "dependencies", "risks", "flow", "velocity", "measure", "workflows", "solution", "integrations", "webhooks", "copilot", "settings"]} onChange={setScreen} />
        </TweaksPanel>
      </div>
    </ThemeCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
