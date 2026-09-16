import { NextResponse } from "next/server";
import { z } from "zod";
import { loadSettings, saveSettings } from "@/lib/store";

export const runtime = "nodejs";

const SettingsSchema = z.object({
  city: z.string().max(120),
  pickupNote: z.string().max(500),
  autoDraft: z.boolean(),
});

/**
 * Pickup details live on the server rather than in one browser, so the phone
 * and every laptop in the house agree about them.
 */
export async function GET() {
  return NextResponse.json({ settings: await loadSettings() });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings." },
      { status: 400 },
    );
  }

  return NextResponse.json({ settings: await saveSettings(parsed.data) });
}
