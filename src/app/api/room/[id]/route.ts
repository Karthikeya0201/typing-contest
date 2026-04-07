import { NextRequest, NextResponse } from 'next/server';
import { rooms, serializeRoom } from '@/lib/store';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  const room = rooms.get(id);

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json(serializeRoom(room));
}
