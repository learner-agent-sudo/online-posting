import { readPhoto } from "@/lib/store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; file: string }> };

/** Serves a stored photo so the desktop can preview it and drag it out. */
export async function GET(_request: Request, { params }: Context) {
  const { id, file } = await params;
  const bytes = await readPhoto(id, file);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(bytes.length),
      // Photos never change once written, and this keeps the inbox snappy
      // while it polls.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
