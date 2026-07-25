// Define Liveblocks types for your application
// https://liveblocks.io/docs/api-reference/liveblocks-react#Typing-your-data
declare global {
  interface Liveblocks {
    // Each user's Presence, for useMyPresence, useOthers, etc.
    Presence: {
      cursor: { x: number; y: number } | null;
      dragging: string | null; // epicId being dragged
    };

    // The Storage tree for the room, for useMutation, useStorage, etc.
    Storage: {
      // Portfolio Kanban — epic cards indexed by epicId
      kanbanEpics?: import("@liveblocks/client").LiveList<
        import("@liveblocks/client").LiveObject<{
          id: string;
          title: string;
          lifecycleStatus: string;
          order: number;
          wsjfScore: number;
          bv: number;
          tc: number;
          rr: number;
          js: number;
        }>
      >;
      
      // PI Planning Confidence Vote
      piState?: string; // 'NOT_STARTED' | 'OPEN' | 'TALLYING' | 'REWORK' | 'APPROVED'
      piVotes?: import("@liveblocks/client").LiveMap<string, number>; // userId -> vote value (1-5)
    };

    // Custom user info set when authenticating with a secret key
    UserMeta: {
      id: string;
      info: {
        name?: string;
        avatar?: string;
        color: string;
      };
    };

    // Custom events, for useBroadcastEvent, useEventListener
    RoomEvent: {};
    // Example has two events, using a union
    // | { type: "PLAY" }
    // | { type: "REACTION"; emoji: "🔥" };

    // Custom metadata set on threads, for useThreads, useCreateThread, etc.
    ThreadMetadata: {
      // Example, attaching coordinates to a thread
      // x: number;
      // y: number;
    };

    // Custom room info set with resolveRoomsInfo, for useRoomInfo
    RoomInfo: {
      // Example, rooms with a title and url
      // title: string;
      // url: string;
    };
  }
}

export {};
