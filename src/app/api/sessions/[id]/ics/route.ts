import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";

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
    if (!session || !session.lockedPlan) {
      return new NextResponse("Locked plan not found", { status: 404 });
    }

    const { lockedPlan } = session;
    const slot = session.options.dateSlots.find((s) => s.id === lockedPlan.slotId);
    const venue = session.options.venues.find((v) => v.id === lockedPlan.venueId);

    // Parse date from slotId (e.g., "2026-11-26_PM" or similar)
    const dateMatch = lockedPlan.slotId.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const timeMatch = lockedPlan.exactTime.match(/^(\d{1,2}):(\d{2})/);

    let startIso = new Date().toISOString();
    let endIso = new Date(Date.now() + 2 * 3600000).toISOString();

    if (dateMatch && timeMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2];
      const day = dateMatch[3];
      const hours = timeMatch[1].padStart(2, "0");
      const mins = timeMatch[2];
      startIso = `${year}${month}${day}T${hours}${mins}00`;

      // Add 2 hours for end time
      const endHours = String((parseInt(hours, 10) + 2) % 24).padStart(2, "0");
      endIso = `${year}${month}${day}T${endHours}${mins}00`;
    }

    const summary = `SyncUp: ${venue ? venue.name : "Meetup"}`;
    const description = `Group Meetup locked via SyncUp.\nVenue: ${venue?.name || "TBD"}\nAddress: ${venue?.address || ""}\nMaps: ${venue?.mapsUrl || ""}`;
    const location = venue ? `${venue.name}, ${venue.address || ""}` : "TBD";

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SyncUp//Meetup Coordination//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${session.sessionId}@syncup.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART:${startIso}`,
      `DTEND:${endIso}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="syncup-${session.slug}.ics"`,
      },
    });
  } catch (err: any) {
    console.error("Error generating ICS:", err);
    return new NextResponse("Error generating calendar invite", { status: 500 });
  }
}
