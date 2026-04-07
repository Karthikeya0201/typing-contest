import { NextRequest, NextResponse } from 'next/server';
import { rooms, serializeRoom, Player } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name } = await req.json();
  
  const room = rooms.get(id);

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.status !== 'waiting') {
    return NextResponse.json({ error: 'Contest already started or finished' }, { status: 400 });
  }

  const playerId = Math.random().toString(36).substring(7);
  const newPlayer: Player = {
    id: playerId,
    name,
    wpm: 0,
    accuracy: 100,
    progress: 0,
    status: 'typing',
    lastSeen: Date.now(),
  };

  room.players.set(playerId, newPlayer);

  return NextResponse.json({ playerId, room: serializeRoom(room) });
}
