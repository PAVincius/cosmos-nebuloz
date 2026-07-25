// cosmos-data.jsx — realistic SAFe demo data for the hero screens.

const ARTS = {
  pay: { name: "Payments ART", tone: "blue" },
  plat: { name: "Platform ART", tone: "purple" },
  growth: { name: "Growth ART", tone: "green" },
  data: { name: "Data & AI ART", tone: "amber" },
};

const KANBAN_COLUMNS = [
  { id: "funnel", label: "Funnel", tone: "neutral", hex: "100,116,139" },
  { id: "reviewing", label: "Reviewing", tone: "amber", hex: "217,119,6" },
  { id: "analyzing", label: "Analyzing", tone: "purple", hex: "124,58,237" },
  { id: "backlog", label: "Portfolio Backlog", tone: "blue", hex: "37,99,235" },
  { id: "implementing", label: "Implementing", tone: "blue", hex: "14,165,233" },
  { id: "done", label: "Done", tone: "green", hex: "22,163,74" },
];

const EPICS = [
  { id: "EP-104", col: "funnel", title: "Carteira digital multi-moeda", theme: "Expansão LATAM", art: "pay", owner: "Marina Alves", wsjf: 11.2, size: 34, progress: 0 },
  { id: "EP-118", col: "funnel", title: "Programa de fidelidade B2B", theme: "Retenção", art: "growth", owner: "Caio Nunes", wsjf: 8.4, size: 21, progress: 0 },
  { id: "EP-097", col: "reviewing", title: "Antifraude em tempo real (ML)", theme: "Confiança & Risco", art: "data", owner: "Letícia Rocha", wsjf: 19.6, size: 55, progress: 6, hot: true },
  { id: "EP-112", col: "reviewing", title: "Onboarding self-service KYC", theme: "Expansão LATAM", art: "pay", owner: "Bruno Dias", wsjf: 14.1, size: 40, progress: 10 },
  { id: "EP-088", col: "analyzing", title: "Plataforma de eventos unificada", theme: "Modernização", art: "plat", owner: "Helena Souza", wsjf: 16.8, size: 68, progress: 22 },
  { id: "EP-101", col: "analyzing", title: "Checkout 1-clique", theme: "Conversão", art: "growth", owner: "Diego Lima", wsjf: 13.3, size: 29, progress: 18 },
  { id: "EP-076", col: "backlog", title: "Migração core para multi-tenant", theme: "Modernização", art: "plat", owner: "Helena Souza", wsjf: 22.4, size: 89, progress: 0, hot: true },
  { id: "EP-093", col: "backlog", title: "Observabilidade ponta-a-ponta", theme: "Confiabilidade", art: "plat", owner: "Rafael Teixeira", wsjf: 12.0, size: 47, progress: 0 },
  { id: "EP-109", col: "backlog", title: "Open Finance · agregação", theme: "Expansão LATAM", art: "pay", owner: "Marina Alves", wsjf: 15.5, size: 52, progress: 0 },
  { id: "EP-061", col: "implementing", title: "SSO & SCIM Enterprise", theme: "Enterprise Ready", art: "plat", owner: "Rafael Teixeira", wsjf: 18.2, size: 34, progress: 64 },
  { id: "EP-070", col: "implementing", title: "Pix recorrente & agendado", theme: "Pagamentos BR", art: "pay", owner: "Bruno Dias", wsjf: 20.1, size: 42, progress: 48, hot: true },
  { id: "EP-085", col: "implementing", title: "Copilot de relatórios financeiros", theme: "Data & AI", art: "data", owner: "Letícia Rocha", wsjf: 17.0, size: 38, progress: 31 },
  { id: "EP-042", col: "done", title: "FinOps guardrails por ART", theme: "Eficiência de Custo", art: "data", owner: "Letícia Rocha", wsjf: 9.8, size: 26, progress: 100 },
  { id: "EP-055", col: "done", title: "Migração para Design System v3", theme: "Modernização", art: "plat", owner: "Helena Souza", wsjf: 7.5, size: 31, progress: 100 },
];

// WSJF backlog (ordered desc by score)
const WSJF_ITEMS = [
  { rank: 1, id: "EP-076", name: "Migração core para multi-tenant", type: "Epic", art: "plat", bv: 21, tc: 18, rr: 13, size: 22, wsjf: 22.4, prev: 3, ai: "+2" },
  { rank: 2, id: "EP-070", name: "Pix recorrente & agendado", type: "Epic", art: "pay", bv: 20, tc: 16, rr: 8, size: 13, wsjf: 20.1, prev: 1, ai: "−1" },
  { rank: 3, id: "EP-097", name: "Antifraude em tempo real (ML)", type: "Epic", art: "data", bv: 18, tc: 20, rr: 13, size: 21, wsjf: 19.6, prev: 2, ai: "−1" },
  { rank: 4, id: "EP-061", name: "SSO & SCIM Enterprise", type: "Epic", art: "plat", bv: 13, tc: 8, rr: 13, size: 8, wsjf: 18.2, prev: 6, ai: "+2" },
  { rank: 5, id: "FE-318", name: "Limites dinâmicos por risco", type: "Feature", art: "pay", bv: 13, tc: 13, rr: 8, size: 5, wsjf: 17.6, prev: 5, ai: "0" },
  { rank: 6, id: "EP-085", name: "Copilot de relatórios financeiros", type: "Epic", art: "data", bv: 16, tc: 8, rr: 8, size: 8, wsjf: 17.0, prev: 4, ai: "−2" },
  { rank: 7, id: "EP-088", name: "Plataforma de eventos unificada", type: "Epic", art: "plat", bv: 13, tc: 13, rr: 13, size: 13, wsjf: 16.8, prev: 7, ai: "0" },
  { rank: 8, id: "EP-109", name: "Open Finance · agregação", type: "Epic", art: "pay", bv: 13, tc: 8, rr: 8, size: 8, wsjf: 15.5, prev: 9, ai: "+1" },
  { rank: 9, id: "FE-274", name: "Reconciliação automática", type: "Feature", art: "pay", bv: 8, tc: 13, rr: 5, size: 5, wsjf: 15.0, prev: 8, ai: "−1" },
  { rank: 10, id: "EP-112", name: "Onboarding self-service KYC", type: "Epic", art: "pay", bv: 13, tc: 8, rr: 5, size: 8, wsjf: 14.1, prev: 11, ai: "+1" },
  { rank: 11, id: "EP-101", name: "Checkout 1-clique", type: "Epic", art: "growth", bv: 13, tc: 5, rr: 5, size: 5, wsjf: 13.3, prev: 10, ai: "−1" },
  { rank: 12, id: "EP-093", name: "Observabilidade ponta-a-ponta", type: "Epic", art: "plat", bv: 8, tc: 8, rr: 8, size: 8, wsjf: 12.0, prev: 12, ai: "0" },
];

Object.assign(window, { ARTS, KANBAN_COLUMNS, EPICS, WSJF_ITEMS });
