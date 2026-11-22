import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { token } = body;

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!token) {
      return NextResponse.json({ isAdmin: false, error: "Token required" }, { status: 400 });
    }

    const isValid = await db.verifyAdmin(session.sessionId, token);

    return NextResponse.json({ isAdmin: isValid });
  } catch (err: any) {
    console.error("Error claiming admin:", err);
    return NextResponse.json({ error: err.message || "Failed to claim admin" }, { status: 500 });
  }
}
