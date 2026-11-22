import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateId } from "@/lib/server/crypto";

const WITTY_NUDGES = [
  (name: string, url: string) =>
    `Hey @${name}! The crew is locking in dinner and we need your 10-second vote before the good spots fill up: ${url}`,
  (name: string, url: string) =>
    `@${name} you're the chosen one holding the keys to our Friday night plans 👀 Drop your availability here (no signup): ${url}`,
  (name: string, url: string) =>
    `Ping @${name}—everyone else voted! Don't let the group pick a venue you hate: ${url}`,
  (name: string, url: string) =>
    `Hey @${name}, 3 taps and you're done! Vote on times & restaurants here: ${url}`,
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { targetParticipantId, senderParticipantId } = await req.json();

    let session = await db.getSessionBySlug(id);
    if (!session) {
      session = await db.getSession(id);
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const target = session.participants[targetParticipantId];
    if (!target) {
      return NextResponse.json({ error: "Target participant not found" }, { status: 404 });
    }

    const nudgeId = generateId("nudge", 8);
    const now = new Date().toISOString();

    await db.addNudge(session.sessionId, {
      id: nudgeId,
      targetParticipantId,
      senderParticipantId: senderParticipantId || session.organizerParticipantId,
      createdAt: now,
      expiresAt: session.expiresAt,
    });

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const origin = `${protocol}://${host}`;
    const voteUrl = `${origin}/s/${session.slug}?nudge_id=${nudgeId}#p=${targetParticipantId}`;

    // Select witty copy template
    const templateIndex = Math.floor(Math.random() * WITTY_NUDGES.length);
    const message = WITTY_NUDGES[templateIndex](target.name, voteUrl);

    return NextResponse.json({
      nudgeId,
      message,
      voteUrl,
      targetName: target.name,
    });
  } catch (err: any) {
    console.error("Error creating nudge:", err);
    return NextResponse.json({ error: err.message || "Failed to create nudge" }, { status: 500 });
  }
}
