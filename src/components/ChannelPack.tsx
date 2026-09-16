"use client";

import { useState } from "react";
import CopyField from "./CopyField";
import { CHANNELS, CHANNEL_IDS, buildPack, type ChannelId } from "@/lib/channels";
import type { Item, ListingCopy, SellerContext } from "@/lib/types";
import { exportFilename, type PreparedPhoto } from "@/lib/photos";

interface Props {
  item: Item;
  copy: ListingCopy;
  context: SellerContext;
  photos: PreparedPhoto[];
  posted: Record<ChannelId, boolean>;
  onTogglePosted: (channel: ChannelId) => void;
}

function base64ToFile(photo: PreparedPhoto, filename: string): File {
  const binary = atob(photo.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: photo.media_type });
}

export default function ChannelPack({
  item,
  copy,
  context,
  photos,
  posted,
  onTogglePosted,
}: Props) {
  const [active, setActive] = useState<ChannelId>("facebook");
  const [shareNote, setShareNote] = useState<string | null>(null);

  const channel = CHANNELS[active];
  const fields = buildPack(item, copy, context, active);

  const files = photos.map((photo, index) =>
    base64ToFile(photo, exportFilename(index, item.name)),
  );

  /**
   * The share sheet is the phone-native path: it hands the cleaned photos
   * straight to Photos or to the Facebook app. Desktop browsers mostly cannot
   * share files, so they fall back to plain downloads.
   */
  async function sharePhotos() {
    setShareNote(null);
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files, title: item.name });
        return;
      } catch (err) {
        // A user cancelling the sheet throws AbortError — not worth a message.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    downloadPhotos();
    setShareNote("Sharing is not available here, so the photos were downloaded instead.");
  }

  function downloadPhotos() {
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser a beat to start the download before revoking.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    });
  }

  return (
    <>
      <div className="tabs" role="tablist">
        {CHANNEL_IDS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active === id}
            onClick={() => setActive(id)}
          >
            {CHANNELS[id].name}
            {posted[id] ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div className="card">
        <h2>1. Open the form</h2>
        <p className="muted">
          Sign in as yourself and start a new listing. Nothing here touches your
          account — you paste the fields and press Publish.
        </p>
        <a href={channel.createUrl} target="_blank" rel="noopener noreferrer">
          <button className="btn-primary" type="button">
            Open {channel.name}
          </button>
        </a>
      </div>

      <div className="card">
        <h2>2. Add the photos</h2>
        <p className="muted">
          {photos.length} photo{photos.length === 1 ? "" : "s"}, numbered in order.
          Metadata already removed.
        </p>
        <div className="btn-row">
          <button type="button" onClick={sharePhotos}>
            Share photos
          </button>
          <button type="button" onClick={downloadPhotos}>
            Download
          </button>
        </div>
        {shareNote && <p className="help">{shareNote}</p>}
      </div>

      <div className="card">
        <h2>3. Paste each field</h2>
        {fields.map((field) => (
          <CopyField key={`${active}-${field.label}`} field={field} />
        ))}
      </div>

      <div className="card">
        <h2>4. Mark it posted</h2>
        <p className="muted">
          So you remember to take it down here when it sells somewhere else.
        </p>
        <div className="toggle-row">
          {CHANNEL_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="toggle"
              aria-pressed={posted[id]}
              onClick={() => onTogglePosted(id)}
            >
              {posted[id] ? "Live on " : "Not on "}
              {CHANNELS[id].name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
