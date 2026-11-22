import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { participantId, adminToken } = await req.json();

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const isAdmin = await db.verifyAdmin(session.sessionId, adminToken);
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const target = session.participants[participantId];
    if (!target) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Add name to removedNames in private meta
    await db.updatePrivateMeta(session.sessionId, (curr) => {
      if (!curr.removedNames.includes(target.name)) {
        curr.removedNames.push(target.name);
      }
      return curr;
    });

    const updated = await db.updateSession(session.sessionId, (curr) => {
      delete curr.participants[participantId];
      return curr;
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error removing participant:", err);
    return NextResponse.json({ error: err.message || "Failed to remove participant" }, { status: 500 });
  }
}
