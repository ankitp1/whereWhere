import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";

export async function POST(
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

    const updated = await db.updateSession(session.sessionId, (curr) => {
      if (curr.lockedPlan) {
        curr.lockedPlan.isBooked = !curr.lockedPlan.isBooked;
      }
      return curr;
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error toggling booked:", err);
    return NextResponse.json({ error: err.message || "Failed to toggle booked" }, { status: 500 });
  }
}
