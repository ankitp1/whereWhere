import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { checkObjectionWindowCompletion } from "@/lib/server/state-machine";

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

    if (session.status !== "objection_window") {
      return NextResponse.json({ session });
    }

    let updated = await db.updateSession(session.sessionId, (curr) => {
      const p = curr.participants[participantId];
      if (p) {
        p.acknowledgedLock = true;
      }
      return curr;
    });

    // Check if 100% of active participants have acknowledged
    if (checkObjectionWindowCompletion(updated)) {
      updated = await db.updateSession(session.sessionId, (curr) => {
        curr.status = "locked";
        return curr;
      });
    }

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error acknowledging lock:", err);
    return NextResponse.json({ error: err.message || "Failed to acknowledge" }, { status: 500 });
  }
}
