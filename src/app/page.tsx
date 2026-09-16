"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PairingCard from "@/components/PairingCard";
import Inbox from "@/components/Inbox";
import PhotoPicker from "@/components/PhotoPicker";
import ReviewForm from "@/components/ReviewForm";
import ChannelPack from "@/components/ChannelPack";
import type { ChannelId } from "@/lib/channels";
import type { PreparedPhoto } from "@/lib/photos";
import type { Item, SellerContext } from "@/lib/types";
import type { BookFacts } from "@/lib/books";
import {
  DEFAULT_SETTINGS,
  type Settings,
  type StoredItem,
} from "@/lib/handoff-types";

type View = "inbox" | "review" | "pack";

const POLL_MS = 4000;

async function callJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const payload = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status}).`);
  return payload;
}

function jsonBody(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export default function Desktop() {
  const [view, setView] = useState<View>("inbox");
  const [items, setItems] = useState<StoredItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [current, setCurrent] = useState<StoredItem | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [enrichment, setEnrichment] = useState<BookFacts | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [researching, setResearching] = useState(false);
  const [uploads, setUploads] = useState<PreparedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Items already sent for auto-drafting, so a slow analysis is not started
  // twice by the next poll.
  const autoDrafted = useRef<Set<string>>(new Set());

  const context: SellerContext = {
    hint: current?.note ?? "",
    city: settings.city,
    pickupNote: settings.pickupNote,
  };

  const refresh = useCallback(async () => {
    try {
      const { items } = await callJson<{ items: StoredItem[] }>("/api/handoff");
      setItems(items);
      return items;
    } catch {
      // A failed poll is not worth an error banner; the next one will retry.
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    callJson<{ settings: Settings }>("/api/settings")
      .then((payload) => setSettings(payload.settings))
      .catch(() => undefined);
  }, [refresh]);

  // Watch for photos arriving from the phone.
  useEffect(() => {
    if (view !== "inbox") return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [view, refresh]);

  const analyze = useCallback(
    async (item: StoredItem, open: boolean) => {
      setBusyId(item.id);
      setError(null);
      try {
        const payload = await callJson<{ item: StoredItem; enrichment: BookFacts | null }>(
          "/api/analyze",
          jsonBody({ itemId: item.id }),
        );
        setItems((prev) => prev.map((i) => (i.id === payload.item.id ? payload.item : i)));
        if (open) {
          setCurrent(payload.item);
          setEnrichment(payload.enrichment);
          setView("review");
          window.scrollTo(0, 0);
        }
        return payload.item;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not write the listing.");
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  // Optional: draft each item as it lands, so a listing is waiting when you
  // sit down. Off by default because every draft costs a few cents.
  useEffect(() => {
    if (!settings.autoDraft || busyId) return;
    const next = items.find((item) => !item.draft && !autoDrafted.current.has(item.id));
    if (!next) return;
    autoDrafted.current.add(next.id);
    void analyze(next, false);
  }, [items, settings.autoDraft, busyId, analyze]);

  async function openItem(item: StoredItem) {
    setError(null);
    try {
      const payload = await callJson<{ item: StoredItem; folder: string }>(
        `/api/handoff/${item.id}`,
      );
      setFolder(payload.folder);
      if (!payload.item.draft) {
        await analyze(payload.item, true);
        return;
      }
      setCurrent(payload.item);
      setEnrichment(null);
      setView("review");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that item.");
    }
  }

  async function patchItem(item: StoredItem, patch: Partial<StoredItem>) {
    const optimistic = { ...item, ...patch };
    setItems((prev) => prev.map((i) => (i.id === item.id ? optimistic : i)));
    if (current?.id === item.id) setCurrent(optimistic);
    try {
      await callJson(`/api/handoff/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that change.");
      void refresh();
    }
  }

  async function deleteItem(item: StoredItem) {
    const name = item.draft?.item.name ?? item.note ?? "this item";
    if (!window.confirm(`Delete ${name} and its photos? This cannot be undone.`)) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (current?.id === item.id) {
      setCurrent(null);
      setView("inbox");
    }
    try {
      await callJson(`/api/handoff/${item.id}`, { method: "DELETE" });
    } catch {
      void refresh();
    }
  }

  function updateItemFacts(next: Item) {
    if (!current?.draft) return;
    const draft = { ...current.draft, item: next };
    setCurrent({ ...current, draft });
    setItems((prev) => prev.map((i) => (i.id === current.id ? { ...i, draft } : i)));
  }

  /** Persist edited facts without rewriting the text. */
  async function saveFacts() {
    if (!current?.draft) return;
    await patchItem(current, { draft: current.draft });
  }

  async function regenerate() {
    if (!current?.draft) return;
    setRegenerating(true);
    setError(null);
    try {
      const payload = await callJson<{ item: StoredItem }>(
        "/api/rewrite",
        jsonBody({ itemId: current.id, item: current.draft.item }),
      );
      setCurrent(payload.item);
      setItems((prev) => prev.map((i) => (i.id === payload.item.id ? payload.item : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rewrite the text.");
    } finally {
      setRegenerating(false);
    }
  }

  async function research() {
    if (!current) return;
    setResearching(true);
    setError(null);
    try {
      const payload = await callJson<{ item: StoredItem }>(
        "/api/comps",
        jsonBody({ itemId: current.id }),
      );
      setCurrent(payload.item);
      setItems((prev) => prev.map((i) => (i.id === payload.item.id ? payload.item : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look up prices.");
    } finally {
      setResearching(false);
    }
  }

  async function saveSettings(changes: Partial<Settings>) {
    const next = { ...settings, ...changes };
    setSettings(next);
    try {
      await callJson("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      // Keeps working for this session; it will be retried on the next change.
    }
  }

  /** Adding photos from this laptop instead of the phone. */
  async function uploadFromDesktop() {
    if (uploads.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await callJson(
        "/api/handoff",
        jsonBody({
          photos: uploads.map((p) => ({ media_type: p.media_type, data: p.data })),
          note: "",
          source: "desktop",
        }),
      );
      uploads.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setUploads([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add those photos.");
    } finally {
      setUploading(false);
    }
  }

  function backToInbox() {
    setView("inbox");
    setCurrent(null);
    setEnrichment(null);
    setFolder(null);
    void refresh();
    window.scrollTo(0, 0);
  }

  return (
    <main>
      <header className="app">
        <h1>ListKit</h1>
        <span className="tagline">
          {view === "inbox" ? "phone sends · laptop posts" : current?.draft?.item.name ?? ""}
        </span>
      </header>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {view === "inbox" && (
        <>
          <PairingCard />

          <Inbox
            items={items}
            busyId={busyId}
            onOpen={(item) => void openItem(item)}
            onTogglePosted={(item, channel) =>
              void patchItem(item, {
                posted: { ...item.posted, [channel]: !item.posted[channel] },
              })
            }
            onToggleSold={(item) => void patchItem(item, { sold: !item.sold })}
            onDelete={(item) => void deleteItem(item)}
          />

          <div className="card">
            <h2>Pickup details</h2>
            <p className="muted">
              Added to the end of every listing, so you only type them once.
            </p>

            <label htmlFor="city">Pickup city</label>
            <input
              id="city"
              type="text"
              list="ontario-cities"
              value={settings.city}
              placeholder="Mississauga, ON"
              onChange={(e) => void saveSettings({ city: e.target.value })}
            />
            <datalist id="ontario-cities">
              {[
                "Toronto, ON", "Mississauga, ON", "Brampton, ON", "Hamilton, ON",
                "London, ON", "Markham, ON", "Vaughan, ON", "Kitchener, ON",
                "Windsor, ON", "Richmond Hill, ON", "Oakville, ON", "Burlington, ON",
                "Oshawa, ON", "Barrie, ON", "Guelph, ON", "Waterloo, ON",
                "Ottawa, ON", "Kingston, ON", "Whitby, ON", "Ajax, ON",
              ].map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>

            <label htmlFor="pickup">Pickup note</label>
            <input
              id="pickup"
              type="text"
              value={settings.pickupNote}
              placeholder="Nearest major intersection. Evenings and weekends."
              onChange={(e) => void saveSettings({ pickupNote: e.target.value })}
            />
            <p className="help">
              Keep it to a neighbourhood or intersection — never your street address.
            </p>

            <label className="checkbox-row" htmlFor="auto">
              <input
                id="auto"
                type="checkbox"
                checked={settings.autoDraft}
                onChange={(e) => void saveSettings({ autoDraft: e.target.checked })}
              />
              <span>
                Draft automatically when photos arrive
                <span className="help" style={{ display: "block", margin: 0 }}>
                  A listing is ready when you sit down, but every arrival costs a
                  few cents whether you use it or not.
                </span>
              </span>
            </label>
          </div>

          <div className="card">
            <h2>Add photos from this laptop</h2>
            <PhotoPicker photos={uploads} onChange={setUploads} onError={setError} />
            <button
              type="button"
              onClick={() => void uploadFromDesktop()}
              disabled={uploading || uploads.length === 0}
            >
              {uploading ? (
                <>
                  <span className="spinner" />
                  Adding…
                </>
              ) : (
                "Add to inbox"
              )}
            </button>
          </div>
        </>
      )}

      {view === "review" && current?.draft && (
        <>
          <ReviewForm
            item={current.draft.item}
            onChange={updateItemFacts}
            enrichment={enrichment}
            onRegenerate={() => void regenerate()}
            regenerating={regenerating}
            comps={current.comps}
            researching={researching}
            onResearch={() => void research()}
            mentionComps={settings.mentionCompsInListing}
            onToggleMentionComps={(value) =>
              void saveSettings({ mentionCompsInListing: value })
            }
          />
          <div className="sticky-actions">
            <div className="inner btn-row">
              <button type="button" onClick={backToInbox}>
                Back to inbox
              </button>
              <button
                className="btn-primary"
                type="button"
                style={{ flex: "2 1 200px" }}
                onClick={async () => {
                  await saveFacts();
                  setView("pack");
                  window.scrollTo(0, 0);
                }}
              >
                Ready to post
              </button>
            </div>
          </div>
        </>
      )}

      {view === "pack" && current?.draft && (
        <>
          <ChannelPack
            stored={current}
            item={current.draft.item}
            copy={current.draft.copy}
            context={context}
            folder={folder}
            comps={current.comps}
            mentionComps={settings.mentionCompsInListing}
            onTogglePosted={(channel) =>
              void patchItem(current, {
                posted: { ...current.posted, [channel]: !current.posted[channel] },
              })
            }
          />
          <div className="sticky-actions">
            <div className="inner btn-row">
              <button type="button" onClick={() => setView("review")}>
                Edit details
              </button>
              <button
                className="btn-primary"
                type="button"
                style={{ flex: "2 1 200px" }}
                onClick={backToInbox}
              >
                Done — back to inbox
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
