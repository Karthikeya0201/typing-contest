import { NextResponse } from 'next/server';
import { rooms, generateRoomId, Room, LONG_PARAGRAPHS } from '@/lib/store';

export async function POST(req: Request) {
  try {
    const { paragraph, duration, capacity } = await req.json();
    
    if (!duration) {
      return NextResponse.json({ error: 'Missing configuration' }, { status: 400 });
    }

    const roomId = generateRoomId();
    const adminId = Math.random().toString(36).substring(7);

    // If paragraph is empty, choose a random long one
    const p = paragraph || LONG_PARAGRAPHS[Math.floor(Math.random() * LONG_PARAGRAPHS.length)];

    const newRoom: Room = {
      id: roomId,
      adminId,
      paragraph: p,
      duration: parseInt(duration),
      capacity: parseInt(capacity) || 40,
      startTime: null,
      status: 'waiting',
      players: new Map(),
    };

    rooms.set(roomId, newRoom);

    return NextResponse.json({ roomId, adminId });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
