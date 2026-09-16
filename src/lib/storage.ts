"use client";

import type { ChannelId } from "./channels";

/**
 * The ledger: which items exist, and where each one is currently live.
 *
 * The real pain of cross-posting is not the posting, it is remembering to take
 * the Kijiji ad down when the thing sells on Facebook. This tracks that.
 *
 * It is localStorage, so it is per-device and per-browser: your phone's list
 * and your laptop's list are different lists, and clearing site data erases it.
 * For a household selling a few things a month that is the right trade against
 * running a database. Every access is wrapped because Safari private mode
 * throws on write rather than failing quietly.
 */

const KEY = "listkit.ledger.v1";
const MAX_ENTRIES = 100;

export interface LedgerEntry {
  id: string;
  name: string;
  askingCad: number;
  createdAt: string;
  thumb: string | null;
  posted: Record<ChannelId, boolean>;
  sold: boolean;
}

export function loadLedger(): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(entries: LedgerEntry[]): LedgerEntry[] {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded or private mode. The in-memory list still works for this
    // session, which is better than throwing away the listing the user is
    // holding.
  }
  return trimmed;
}

export function addEntry(entry: LedgerEntry): LedgerEntry[] {
  return persist([entry, ...loadLedger().filter((e) => e.id !== entry.id)]);
}

export function updateEntry(id: string, patch: Partial<LedgerEntry>): LedgerEntry[] {
  return persist(loadLedger().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function removeEntry(id: string): LedgerEntry[] {
  return persist(loadLedger().filter((e) => e.id !== id));
}

export function togglePosted(id: string, channel: ChannelId): LedgerEntry[] {
  return persist(
    loadLedger().map((e) =>
      e.id === id ? { ...e, posted: { ...e.posted, [channel]: !e.posted[channel] } } : e,
    ),
  );
}
