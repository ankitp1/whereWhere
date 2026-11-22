import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { checkObjectionWindowCompletion } from "@/lib/server/state-machine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check if objection window has expired and needs auto-lock
    if (session.status === "objection_window" && checkObjectionWindowCompletion(session)) {
      session = await db.updateSession(session.sessionId, (curr) => {
        curr.status = "locked";
        return curr;
      });
    }

    return NextResponse.json({ session });
  } catch (err: any) {
    console.error("Error fetching session:", err);
    return NextResponse.json({ error: err.message || "Failed to get session" }, { status: 500 });
  }
}
