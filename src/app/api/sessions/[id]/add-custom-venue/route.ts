import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { generateId } from "@/lib/server/crypto";
import { VenueOption } from "@/types/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { participantId, name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Venue name is required" }, { status: 400 });
    }

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

    // Check if participant already added a suggestion
    const alreadySuggested = session.options.venues.some(
      (v) => v.suggestedBy === participantId
    );
    if (alreadySuggested) {
      return NextResponse.json(
        { error: "You can only add up to 1 venue suggestion per person." },
        { status: 400 }
      );
    }

    const cleanName = name.trim().slice(0, 50);
    const newVenue: VenueOption = {
      id: generateId("v_custom", 6),
      placeId: "custom_" + generateId("", 6),
      name: cleanName,
      rating: 4.5,
      priceLevel: "$$",
      mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(cleanName)}`,
      inferredTags: [`Suggested by ${participant.name}`],
      disqualifiedReason: null,
      suggestedBy: participantId,
    };

    const updated = await db.updateSession(session.sessionId, (curr) => {
      curr.options.venues.push(newVenue);
      return curr;
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error adding custom venue:", err);
    return NextResponse.json({ error: err.message || "Failed to add venue" }, { status: 500 });
  }
}
