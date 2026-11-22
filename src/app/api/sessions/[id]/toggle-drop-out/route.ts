import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { participantId } = await req.json();

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const participant = session.participants[participantId];
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const updated = await db.updateSession(session.sessionId, (curr) => {
      const p = curr.participants[participantId];
      if (p) {
        p.status = p.status === "dropped_out" ? "done" : "dropped_out";
      }
      return curr;
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error toggling drop-out:", err);
    return NextResponse.json({ error: err.message || "Failed to toggle drop out" }, { status: 500 });
  }
}
