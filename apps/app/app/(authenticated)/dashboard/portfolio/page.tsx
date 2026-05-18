import { redirect } from "next/navigation";

/** Kanban canónico em /portfolio — evita duplicar duas UIs de portfólio. */
export default function DashboardPortfolioRedirect() {
  redirect("/portfolio");
}
