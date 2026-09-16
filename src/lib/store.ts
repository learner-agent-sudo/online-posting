import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Settings, StoredItem, StoredPhoto } from "./handoff-types";
import { DEFAULT_SETTINGS } from "./handoff-types";

/**
 * Server-side store for the phone-to-desktop handoff.
 *
 * The laptop running this app is the hub: the phone sends photos to it over the
 * home wifi and they land here, on the laptop's own disk, where the browser can
 * upload them into Marketplace. Nothing goes to a cloud service, so there is no
 * account to manage and no bill.
 *
 * Plain files rather than a database — a household lists a few things a month,
 * and a directory you can open in Finder is easier to trust and to clean up.
 */

const DATA_DIR = process.env.LISTKIT_DATA_DIR
  ? path.resolve(process.env.LISTKIT_DATA_DIR)
  : path.join(process.cwd(), ".data");

const ITEMS_DIR = path.join(DATA_DIR, "items");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export type { StoredItem, StoredPhoto, Settings } from "./handoff-types";
export { DEFAULT_SETTINGS } from "./handoff-types";

async function ensureDirs() {
  await fs.mkdir(ITEMS_DIR, { recursive: true });
}

function itemDir(id: string): string {
  // Ids are generated here, never taken from a request path, but resolve and
  // check anyway so a crafted id can never climb out of the data directory.
  const dir = path.join(ITEMS_DIR, id);
  if (path.dirname(dir) !== ITEMS_DIR) throw new Error("Bad item id.");
  return dir;
}

async function readMeta(id: string): Promise<StoredItem | null> {
  try {
    const raw = await fs.readFile(path.join(itemDir(id), "meta.json"), "utf8");
    return JSON.parse(raw) as StoredItem;
  } catch {
    return null;
  }
}

async function writeMeta(item: StoredItem): Promise<void> {
  const dir = itemDir(item.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(item, null, 2), "utf8");
}

export interface IncomingPhoto {
  data: string;
  media_type: string;
}

export async function createItem(
  photos: IncomingPhoto[],
  note: string,
  source: StoredItem["source"],
): Promise<StoredItem> {
  await ensureDirs();
  const id = randomUUID();
  const dir = itemDir(id);
  await fs.mkdir(dir, { recursive: true });

  const stored: StoredPhoto[] = [];
  for (const [index, photo] of photos.entries()) {
    const bytes = Buffer.from(photo.data, "base64");
    const file = `${String(index + 1).padStart(2, "0")}.jpg`;
    await fs.writeFile(path.join(dir, file), bytes);
    stored.push({ file, bytes: bytes.length, mediaType: photo.media_type });
  }

  const item: StoredItem = {
    id,
    createdAt: new Date().toISOString(),
    note,
    source,
    photos: stored,
    draft: null,
    comps: null,
    posted: { facebook: false, kijiji: false },
    sold: false,
  };
  await writeMeta(item);
  return item;
}

export async function listItems(): Promise<StoredItem[]> {
  await ensureDirs();
  const ids = await fs.readdir(ITEMS_DIR).catch(() => [] as string[]);
  const items = await Promise.all(ids.map((id) => readMeta(id)));
  return items
    .filter((item): item is StoredItem => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getItem(id: string): Promise<StoredItem | null> {
  return readMeta(id);
}

export async function updateItem(
  id: string,
  patch: Partial<Omit<StoredItem, "id" | "photos">>,
): Promise<StoredItem | null> {
  const item = await readMeta(id);
  if (!item) return null;
  const next = { ...item, ...patch };
  await writeMeta(next);
  return next;
}

export async function deleteItem(id: string): Promise<boolean> {
  try {
    await fs.rm(itemDir(id), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function readPhoto(id: string, file: string): Promise<Buffer | null> {
  // The filename comes off the URL, so only accept the exact shape we write.
  if (!/^\d{2}\.jpg$/.test(file)) return null;
  try {
    return await fs.readFile(path.join(itemDir(id), file));
  } catch {
    return null;
  }
}

/** Base64 payloads for the model call, read back off disk. */
export async function readPhotosAsBase64(
  item: StoredItem,
): Promise<{ media_type: string; data: string }[]> {
  const dir = itemDir(item.id);
  return Promise.all(
    item.photos.map(async (photo) => ({
      media_type: photo.mediaType,
      data: (await fs.readFile(path.join(dir, photo.file))).toString("base64"),
    })),
  );
}

/** Shown on the desktop so photos can be dragged straight from the file manager. */
export function itemFolderPath(id: string): string {
  return itemDir(id);
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf8");
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await ensureDirs();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
  return settings;
}
