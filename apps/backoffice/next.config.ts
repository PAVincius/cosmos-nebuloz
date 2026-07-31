import { config } from "@repo/next-config";
import { withLogging } from "@repo/observability/next-config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = withLogging(config);

export default nextConfig;
