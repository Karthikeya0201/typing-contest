import { NextRequest, NextResponse } from 'next/server';
import { rooms } from '@/lib/store';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  const { adminId } = await req.json();
  
  const room = rooms.get(id);

  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.adminId !== adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  room.status = 'starting';
  room.startTime = Date.now() + 5000; // Start in 5 seconds (countdown)

  // Transition to active after countdown is handled by clients or checking status
  
  return NextResponse.json({ success: true, startTime: room.startTime });
}
