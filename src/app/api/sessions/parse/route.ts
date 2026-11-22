import { NextRequest, NextResponse } from "next/server";
import { parseMessyIntent } from "@/lib/server/parser";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing or invalid text" }, { status: 400 });
    }

    const parsed = await parseMessyIntent(text);
    return NextResponse.json({ parsed });
  } catch (err: any) {
    console.error("Error parsing intent:", err);
    return NextResponse.json({ error: err.message || "Failed to parse text" }, { status: 500 });
  }
}
