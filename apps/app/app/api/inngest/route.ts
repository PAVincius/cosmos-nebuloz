import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";

// billingSyncFunction imported here when available (Task 11)
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
