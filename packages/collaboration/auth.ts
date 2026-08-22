import "server-only";
import { Liveblocks as LiveblocksNode } from "@liveblocks/node";
import { keys } from "./keys";

type AuthenticateOptions = {
  userId: string;
  orgId: string;
  userInfo: Liveblocks["UserMeta"]["info"];
};

// Story-031: room-scoped auth with per-room access control
type AuthenticateRoomOptions = {
  userId: string;
  room: string;
  canWrite: boolean;
  userInfo: Liveblocks["UserMeta"]["info"];
};

const secret = keys().LIVEBLOCKS_SECRET;

const authenticate = async ({
  userId,
  orgId,
  userInfo,
}: AuthenticateOptions) => {
  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET is not set");
  }

  if (!orgId) {
    throw new Error("orgId is required for room scoping");
  }

  const liveblocks = new LiveblocksNode({ secret });

  const session = liveblocks.prepareSession(userId, { userInfo });

  session.allow(`${orgId}:*`, session.FULL_ACCESS);

  const { status, body } = await session.authorize();

  return new Response(body, { status });
};

export const authenticateRoom = async ({
  userId,
  room,
  canWrite,
  userInfo,
}: AuthenticateRoomOptions): Promise<Response> => {
  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET is not set");
  }

  const liveblocks = new LiveblocksNode({ secret });
  const session = liveblocks.prepareSession(userId, { userInfo });

  session.allow(room, canWrite ? session.FULL_ACCESS : session.READ_ACCESS);

  const { status, body } = await session.authorize();
  return new Response(body, { status });
};
