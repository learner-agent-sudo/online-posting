"use client";

import { useEffect, useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import ReviewForm from "@/components/ReviewForm";
import ChannelPack from "@/components/ChannelPack";
import Ledger from "@/components/Ledger";
import type { ChannelId } from "@/lib/channels";
import { makeThumbnail, type PreparedPhoto } from "@/lib/photos";
import {
  DEFAULT_SELLER_CONTEXT,
  type Draft,
  type Item,
  type SellerContext,
} from "@/lib/types";
import type { BookFacts } from "@/lib/books";
import {
  addEntry,
  loadLedger,
  removeEntry,
  togglePosted,
  updateEntry,
  type LedgerEntry,
} from "@/lib/storage";

type Step = "capture" | "review" | "pack";

const CONTEXT_KEY = "listkit.context.v1";
const NO_CHANNELS: Record<ChannelId, boolean> = { facebook: false, kijiji: false };

/** City and pickup terms rarely change between listings, so remember them. */
function loadSavedContext(): SellerContext {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (!raw) return DEFAULT_SELLER_CONTEXT;
    const saved = JSON.parse(raw) as Partial<SellerContext>;
    return {
      hint: "",
      city: saved.city ?? "",
      pickupNote: saved.pickupNote ?? "",
    };
  } catch {
    return DEFAULT_SELLER_CONTEXT;
  }
}

export default function Home() {
  const [step, setStep] = useState<Step>("capture");
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [context, setContext] = useState<SellerContext>(DEFAULT_SELLER_CONTEXT);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [enrichment, setEnrichment] = useState<BookFacts | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [posted, setPosted] = useState<Record<ChannelId, boolean>>(NO_CHANNELS);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // localStorage is not available during server rendering.
  useEffect(() => {
    setContext(loadSavedContext());
    setLedger(loadLedger());
  }, []);

  function updateContext(changes: Partial<SellerContext>) {
    const next = { ...context, ...changes };
    setContext(next);
    try {
      localStorage.setItem(
        CONTEXT_KEY,
        JSON.stringify({ city: next.city, pickupNote: next.pickupNote }),
      );
    } catch {
      // Private mode. The values still hold for this session.
    }
  }

  async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(payload.error ?? `Request failed (${res.status}).`);
    return payload;
  }

  async function analyze() {
    if (photos.length === 0) {
      setError("Add at least one photo first.");
      return;
    }
    setError(null);
    setAnalyzing(true);

    try {
      const result = await postJson<{ draft: Draft; enrichment: BookFacts | null }>(
        "/api/analyze",
        {
          photos: photos.map((p) => ({ media_type: p.media_type, data: p.data })),
          context,
        },
      );

      setDraft(result.draft);
      setEnrichment(result.enrichment);
      setPosted(NO_CHANNELS);

      const id = crypto.randomUUID();
      setEntryId(id);
      setLedger(
        addEntry({
          id,
          name: result.draft.item.name,
          askingCad: result.draft.item.price.asking_cad,
          createdAt: new Date().toISOString(),
          thumb: await makeThumbnail(photos[0]),
          posted: { ...NO_CHANNELS },
          sold: false,
        }),
      );

      setStep("review");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function regenerate() {
    if (!draft) return;
    setError(null);
    setRegenerating(true);
    try {
      const result = await postJson<{ copy: Draft["copy"] }>("/api/rewrite", {
        item: draft.item,
        context,
      });
      setDraft({ ...draft, copy: result.copy });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rewrite the text.");
    } finally {
      setRegenerating(false);
    }
  }

  function updateItem(item: Item) {
    if (!draft) return;
    setDraft({ ...draft, item });
    if (entryId) {
      setLedger(updateEntry(entryId, { name: item.name, askingCad: item.price.asking_cad }));
    }
  }

  function markPosted(channel: ChannelId) {
    setPosted((prev) => ({ ...prev, [channel]: !prev[channel] }));
    if (entryId) setLedger(togglePosted(entryId, channel));
  }

  function startOver() {
    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setDraft(null);
    setEnrichment(null);
    setEntryId(null);
    setPosted(NO_CHANNELS);
    setContext({ ...context, hint: "" });
    setError(null);
    setStep("capture");
    window.scrollTo(0, 0);
  }

  return (
    <main>
      <header className="app">
        <h1>ListKit</h1>
        <span className="tagline">photos → listing</span>
      </header>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {step === "capture" && (
        <>
          <PhotoPicker photos={photos} onChange={setPhotos} onError={setError} />

          <div className="card">
            <h2>Anything worth knowing?</h2>
            <label htmlFor="hint">What is it, and anything the camera missed</label>
            <textarea
              id="hint"
              value={context.hint}
              placeholder="Solid oak dining table, seats 6. Bought 2019. Small water ring on one corner."
              onChange={(e) => updateContext({ hint: e.target.value })}
            />
            <p className="help">
              Optional, but two lines here makes a much better listing than photos
              alone — you know things the photos cannot show.
            </p>

            <label htmlFor="city">Pickup city</label>
            <input
              id="city"
              type="text"
              list="ontario-cities"
              value={context.city}
              placeholder="Mississauga, ON"
              onChange={(e) => updateContext({ city: e.target.value })}
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
              value={context.pickupNote}
              placeholder="Near Hurontario & Eglinton. Evenings and weekends."
              onChange={(e) => updateContext({ pickupNote: e.target.value })}
            />
            <p className="help">
              Added to the end of every description. Keep it to a neighbourhood or
              intersection — never your street address.
            </p>
          </div>

          <Ledger
            entries={ledger}
            onTogglePosted={(id, channel) => setLedger(togglePosted(id, channel))}
            onToggleSold={(id) => {
              const entry = ledger.find((e) => e.id === id);
              if (entry) setLedger(updateEntry(id, { sold: !entry.sold }));
            }}
            onRemove={(id) => setLedger(removeEntry(id))}
          />

          <div className="sticky-actions">
            <div className="inner">
              <button
                className="btn-primary"
                type="button"
                onClick={analyze}
                disabled={analyzing || photos.length === 0}
              >
                {analyzing ? (
                  <>
                    <span className="spinner" />
                    Reading the photos…
                  </>
                ) : (
                  "Write my listing"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {step === "review" && draft && (
        <>
          <ReviewForm
            item={draft.item}
            onChange={updateItem}
            enrichment={enrichment}
            onRegenerate={regenerate}
            regenerating={regenerating}
          />
          <div className="sticky-actions">
            <div className="inner btn-row">
              <button type="button" onClick={() => setStep("capture")}>
                Back
              </button>
              <button
                className="btn-primary"
                type="button"
                style={{ flex: "2 1 200px" }}
                onClick={() => {
                  setStep("pack");
                  window.scrollTo(0, 0);
                }}
              >
                Ready to post
              </button>
            </div>
          </div>
        </>
      )}

      {step === "pack" && draft && (
        <>
          <ChannelPack
            item={draft.item}
            copy={draft.copy}
            context={context}
            photos={photos}
            posted={posted}
            onTogglePosted={markPosted}
          />
          <div className="sticky-actions">
            <div className="inner btn-row">
              <button type="button" onClick={() => setStep("review")}>
                Edit details
              </button>
              <button className="btn-primary" type="button" style={{ flex: "2 1 200px" }} onClick={startOver}>
                List something else
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
