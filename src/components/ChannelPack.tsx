"use client";

import { useState } from "react";
import CopyField from "./CopyField";
import { CHANNELS, CHANNEL_IDS, buildPack, type ChannelId } from "@/lib/channels";
import type { Comps, Item, ListingCopy, SellerContext } from "@/lib/types";
import { photoUrl, zipUrl, type StoredItem } from "@/lib/handoff-types";

interface Props {
  stored: StoredItem;
  item: Item;
  copy: ListingCopy;
  context: SellerContext;
  folder: string | null;
  comps: Comps | null;
  mentionComps: boolean;
  onTogglePosted: (channel: ChannelId) => void;
}

/**
 * The desktop half of the job. Everything here assumes a real keyboard and a
 * working clipboard, which is the entire reason posting moved off the phone.
 */
export default function ChannelPack({
  stored,
  item,
  copy,
  context,
  folder,
  comps,
  mentionComps,
  onTogglePosted,
}: Props) {
  const [active, setActive] = useState<ChannelId>("facebook");
  const [copiedPath, setCopiedPath] = useState(false);

  const channel = CHANNELS[active];
  const fields = buildPack(item, copy, context, active, { comps, mentionComps });

  async function copyFolder() {
    if (!folder) return;
    try {
      await navigator.clipboard.writeText(folder);
      setCopiedPath(true);
      window.setTimeout(() => setCopiedPath(false), 1800);
    } catch {
      // Clipboard blocked; the path is on screen to read either way.
    }
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
            {stored.posted[id] ? " ✓" : ""}
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
          Already on this laptop, numbered in upload order, with the camera&apos;s
          location data stripped out.
        </p>

        <div className="photo-grid">
          {stored.photos.map((photo, index) => (
            <div className="photo-tile" key={photo.file}>
              <img src={photoUrl(stored.id, photo.file)} alt={`Photo ${index + 1}`} />
              <span className="badge">{index === 0 ? "Cover" : index + 1}</span>
            </div>
          ))}
        </div>

        <p className="help">
          Drag them straight from the folder into the upload box, or download them
          as one zip.
        </p>

        <div className="btn-row">
          <a href={zipUrl(stored.id)} download>
            <button type="button" style={{ width: "100%" }}>
              Download all as zip
            </button>
          </a>
          {folder && (
            <button type="button" onClick={copyFolder}>
              {copiedPath ? "Path copied" : "Copy folder path"}
            </button>
          )}
        </div>

        {folder && <div className="field-value" style={{ fontSize: "0.8rem" }}>{folder}</div>}
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
              aria-pressed={stored.posted[id]}
              onClick={() => onTogglePosted(id)}
            >
              {stored.posted[id] ? "Live on " : "Not on "}
              {CHANNELS[id].name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
