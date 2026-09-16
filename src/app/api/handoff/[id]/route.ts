import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteItem, getItem, itemFolderPath, updateItem } from "@/lib/store";
import { CompsSchema, DraftSchema } from "@/lib/types";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  note: z.string().max(2000).optional(),
  draft: DraftSchema.nullable().optional(),
  comps: CompsSchema.nullable().optional(),
  posted: z.object({ facebook: z.boolean(), kijiji: z.boolean() }).optional(),
  sold: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "No such item." }, { status: 404 });
  return NextResponse.json({ item, folder: itemFolderPath(id) });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid change." },
      { status: 400 },
    );
  }

  const item = await updateItem(id, parsed.data);
  if (!item) return NextResponse.json({ error: "No such item." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  await deleteItem(id);
  return NextResponse.json({ ok: true });
}
