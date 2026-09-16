"use client";

import { CHANNELS, CHANNEL_IDS, type ChannelId } from "@/lib/channels";
import { photoUrl, type StoredItem } from "@/lib/handoff-types";

interface Props {
  items: StoredItem[];
  busyId: string | null;
  onOpen: (item: StoredItem) => void;
  onTogglePosted: (item: StoredItem, channel: ChannelId) => void;
  onToggleSold: (item: StoredItem) => void;
  onDelete: (item: StoredItem) => void;
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function status(item: StoredItem): { label: string; low: boolean } {
  if (item.sold) return { label: "sold", low: false };
  const live = CHANNEL_IDS.filter((id) => item.posted[id]);
  if (live.length > 0) {
    return { label: `live on ${live.map((id) => CHANNELS[id].name).join(" + ")}`, low: false };
  }
  if (item.draft) return { label: "drafted", low: false };
  return { label: "needs a draft", low: true };
}

export default function Inbox({
  items,
  busyId,
  onOpen,
  onTogglePosted,
  onToggleSold,
  onDelete,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="card">
        <h2>Nothing here yet</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Photograph something on the phone and it will appear here within a few
          seconds. You can also add photos from this laptop below.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Inbox</h2>
      <p className="muted">
        {items.filter((i) => !i.sold).length} not sold yet. New photos from the
        phone land here on their own.
      </p>

      {items.map((item) => {
        const state = status(item);
        const cover = item.photos[0];
        return (
          <div className={`ledger-item${item.sold ? " sold" : ""}`} key={item.id}>
            {cover ? (
              <img src={photoUrl(item.id, cover.file)} alt="" />
            ) : (
              <div style={{ width: 48, height: 48, flexShrink: 0 }} />
            )}

            <div className="meta">
              <button className="name-button" type="button" onClick={() => onOpen(item)}>
                {item.draft?.item.name ?? item.note ?? "Untitled item"}
              </button>
              <div className="sub">
                {item.draft ? `$${item.draft.item.price.asking_cad} · ` : ""}
                {item.photos.length} photo{item.photos.length === 1 ? "" : "s"} ·{" "}
                {timeAgo(item.createdAt)} · <span className={state.low ? "pill low" : ""}>{state.label}</span>
              </div>
              <div className="toggle-row" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="toggle"
                  onClick={() => onOpen(item)}
                  disabled={busyId === item.id}
                >
                  {busyId === item.id ? "Working…" : item.draft ? "Open" : "Write listing"}
                </button>
                {CHANNEL_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="toggle"
                    aria-pressed={item.posted[id]}
                    onClick={() => onTogglePosted(item, id)}
                  >
                    {id === "facebook" ? "FB" : "Kijiji"}
                  </button>
                ))}
                <button
                  type="button"
                  className="toggle"
                  aria-pressed={item.sold}
                  onClick={() => onToggleSold(item)}
                >
                  Sold
                </button>
                <button type="button" className="toggle btn-danger" onClick={() => onDelete(item)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
