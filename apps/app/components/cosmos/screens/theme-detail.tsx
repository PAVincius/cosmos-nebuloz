import { getTheme } from "@/app/(cosmos)/actions/themes";
import { ComingSoon } from "../shell";
import ThemeDetailClient from "./theme-detail-client";

export default async function ThemeDetailScreen({ param }: { param?: string }) {
  if (!param) {
    return <ComingSoon id="theme" />;
  }
  const res = await getTheme(param);
  if (!(res.ok && res.data)) {
    return <ComingSoon id="theme" />;
  }
  return <ThemeDetailClient initial={res.data} />;
}
