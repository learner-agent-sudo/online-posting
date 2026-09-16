import type { Comps, Draft } from "./types";
import type { ChannelId } from "./channels";

/**
 * Shapes shared between the server store and the browser. Kept apart from
 * store.ts so client components can import them without dragging node:fs along.
 */

export interface StoredPhoto {
  file: string;
  bytes: number;
  mediaType: string;
}

export interface StoredItem {
  id: string;
  createdAt: string;
  /** Whatever the person typed on the phone while photographing it. */
  note: string;
  source: "phone" | "desktop";
  photos: StoredPhoto[];
  /** Null until the desktop runs the analysis. */
  draft: Draft | null;
  /** Null until price research is run; it is a separate, opt-in step. */
  comps: Comps | null;
  posted: Record<ChannelId, boolean>;
  sold: boolean;
}

export interface Settings {
  city: string;
  pickupNote: string;
  /** Put the researched range into the public listing text. Off by default. */
  mentionCompsInListing: boolean;
  /** Run the analysis as soon as photos land, so a draft is waiting for you. */
  autoDraft: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  city: "",
  pickupNote: "",
  autoDraft: false,
  mentionCompsInListing: false,
};

export function photoUrl(itemId: string, file: string): string {
  return `/api/handoff/${itemId}/photo/${file}`;
}

export function zipUrl(itemId: string): string {
  return `/api/handoff/${itemId}/zip`;
}

/** Filenames that sort into the order the photos should be uploaded in. */
export function exportFilename(index: number, itemName: string): string {
  const slug = itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "listing";
  return `${String(index + 1).padStart(2, "0")}-${slug}.jpg`;
}
