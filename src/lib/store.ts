// Local in-memory store for development. 
// Note: In serverless production, this would use Redis or a Database.
const globalStore = global as unknown as {
  rooms: Map<string, Room>;
};

if (!globalStore.rooms) {
  globalStore.rooms = new Map();
}

export type Player = {
  id: string;
  name: string;
  wpm: number;
  accuracy: number;
  progress: number; // 0 to 100
  status: 'typing' | 'finished';
  lastSeen: number;
};

export type Room = {
  id: string;
  adminId: string;
  paragraph: string;
  duration: number; // seconds
  capacity: number;
  startTime: number | null;
  status: 'waiting' | 'starting' | 'active' | 'finished';
  players: Map<string, Player>;
};

export { LONG_PARAGRAPHS } from './paragraphs';

export const rooms = globalStore.rooms;

export function serializeRoom(room: Room) {
  return {
    ...room,
    players: Array.from(room.players.values()).sort((a, b) => {
      // Sort by status finished first, then WPM descending
      if (a.status === 'finished' && b.status !== 'finished') return -1;
      if (a.status !== 'finished' && b.status === 'finished') return 1;
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      return b.accuracy - a.accuracy; // Tie-breaker: Accuracy
    }),
  };
}

export function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
