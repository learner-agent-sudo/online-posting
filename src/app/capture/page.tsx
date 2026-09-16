"use client";

import { useState } from "react";
import PhotoPicker from "@/components/PhotoPicker";
import type { PreparedPhoto } from "@/lib/photos";

/**
 * The phone's whole job: photograph the thing, say a sentence about it, send.
 *
 * Deliberately the smallest screen in the app. No analysis runs here and no
 * text ever has to be copied on a phone keyboard — that was the whole problem
 * with doing this on mobile.
 */
export default function Capture() {
  const [photos, setPhotos] = useState<PreparedPhoto[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [batch, setBatch] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (photos.length === 0) {
      setError("Take a photo first.");
      return;
    }
    setError(null);
    setSending(true);

    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: photos.map((p) => ({ media_type: p.media_type, data: p.data })),
          note,
          source: "phone",
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? `Upload failed (${res.status}).`);

      setSentCount(photos.length);
      setBatch((n) => n + 1);
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      setPhotos([]);
      setNote("");
      window.scrollTo(0, 0);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Check that the laptop is still running ListKit and that you are on the home wifi.`
          : "Upload failed.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main>
      <header className="app">
        <h1>Send to the laptop</h1>
        <span className="tagline">{batch > 0 ? `${batch} sent` : "photos only"}</span>
      </header>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {sentCount !== null && photos.length === 0 && (
        <div className="notice" role="status">
          <strong>Sent — {sentCount} photo{sentCount === 1 ? "" : "s"}.</strong> It is
          waiting on the laptop. Photograph the next thing whenever you like.
        </div>
      )}

      <PhotoPicker photos={photos} onChange={setPhotos} onError={setError} />

      <div className="card">
        <h2>What is it?</h2>
        <textarea
          value={note}
          placeholder="Oak dining table, seats 6. Small water ring on one corner."
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="help">
          Optional, and a voice-dictated sentence is plenty. You know things the
          photos cannot show — age, what is wrong with it, why you are selling.
        </p>
      </div>

      <div className="sticky-actions">
        <div className="inner">
          <button
            className="btn-primary"
            type="button"
            onClick={send}
            disabled={sending || photos.length === 0}
          >
            {sending ? (
              <>
                <span className="spinner" />
                Sending {photos.length} photo{photos.length === 1 ? "" : "s"}…
              </>
            ) : (
              "Send to the laptop"
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
