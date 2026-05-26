import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { billingSyncFunction } from "@/lib/inngest/billing-sync";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [billingSyncFunction],
});
