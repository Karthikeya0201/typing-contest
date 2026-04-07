import { NextRequest, NextResponse } from 'next/server';
import { rooms } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  const { playerId, wpm, accuracy, progress, status } = await req.json();
  
  const room = rooms.get(id);

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  const player = room.players.get(playerId);
  if (!player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  // Update player stats
  player.wpm = wpm;
  player.accuracy = accuracy;
  player.progress = progress;
  player.status = status;
  player.lastSeen = Date.now();

  // If everyone is finished, or time is up in client side, 
  // room status will be managed by next interval or this player's completion.

  return NextResponse.json({ success: true });
}
