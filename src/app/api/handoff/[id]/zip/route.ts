import { getItem, itemFolderPath, readPhoto } from "@/lib/store";
import { buildZip, type ZipEntry } from "@/lib/zip";
import { exportFilename } from "@/lib/handoff-types";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/** All the photos in one download, named so they sort into upload order. */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) return new Response("Not found", { status: 404 });

  const name = item.draft?.item.name ?? item.note ?? "listing";
  const entries: ZipEntry[] = [];

  for (const [index, photo] of item.photos.entries()) {
    const bytes = await readPhoto(id, photo.file);
    if (bytes) entries.push({ name: exportFilename(index, name), data: new Uint8Array(bytes) });
  }

  const zip = buildZip(entries, new Date(item.createdAt));
  // Detach a plain ArrayBuffer so the Response body type is unambiguous.
  const body = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  const downloadName = exportFilename(0, name).replace(/^01-/, "").replace(/\.jpg$/, "");

  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": `attachment; filename="${downloadName}-photos.zip"`,
      "X-Item-Folder": itemFolderPath(id),
    },
  });
}
