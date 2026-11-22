import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { findGroundedVenues } from "@/lib/server/places";

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

    const areaConstraint = session.constraints.find((c) => c.type === "area");
    const areaName = areaConstraint ? areaConstraint.label : "Midtown";
    const venues = await findGroundedVenues(areaName, session.constraints);

    // Keep any existing custom suggestions
    const customVenues = session.options.venues.filter((v) => !!v.suggestedBy);
    const combined = [...venues, ...customVenues];

    const updated = await db.updateSession(session.sessionId, (curr) => {
      curr.options.venues = combined;
      return curr;
    });

    return NextResponse.json({ session: updated });
  } catch (err: any) {
    console.error("Error finding venues:", err);
    return NextResponse.json({ error: err.message || "Failed to find venues" }, { status: 500 });
  }
}
