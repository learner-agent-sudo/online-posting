import { NextResponse } from "next/server";
import { z } from "zod";
import { createItem, listItems } from "@/lib/store";
import { PhotoSchema, MAX_PHOTOS } from "@/lib/api-contract";

export const runtime = "nodejs";

const UploadSchema = z.object({
  photos: z.array(PhotoSchema).min(1).max(MAX_PHOTOS),
  note: z.string().max(2000).default(""),
  source: z.enum(["phone", "desktop"]).default("phone"),
});

/** The phone drops a batch of photos here and is done — no waiting. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid upload." },
      { status: 400 },
    );
  }

  try {
    const item = await createItem(parsed.data.photos, parsed.data.note, parsed.data.source);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the photos." },
      { status: 500 },
    );
  }
}

/** The desktop polls this to notice new arrivals. */
export async function GET() {
  try {
    return NextResponse.json({ items: await listItems() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read saved items." },
      { status: 500 },
    );
  }
}
