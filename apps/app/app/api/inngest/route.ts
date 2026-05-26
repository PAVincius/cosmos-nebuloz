import { serve } from "inngest/next";
import { billingSyncFunction } from "@/lib/inngest/billing-sync";
import { inngest } from "@/lib/inngest/client";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [billingSyncFunction],
});
