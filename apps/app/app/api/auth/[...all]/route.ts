import { auth } from "@repo/auth/server";
import type { NextRequest } from "next/server";

export const GET = (request: NextRequest) => auth.handler(request);
export const POST = (request: NextRequest) => auth.handler(request);
