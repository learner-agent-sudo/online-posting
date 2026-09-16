"use client";

import { CHANNELS, CHANNEL_IDS, type ChannelId } from "@/lib/channels";
import type { LedgerEntry } from "@/lib/storage";

interface Props {
  entries: LedgerEntry[];
  onTogglePosted: (id: string, channel: ChannelId) => void;
  onToggleSold: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function Ledger({ entries, onTogglePosted, onToggleSold, onRemove }: Props) {
  if (entries.length === 0) return null;

  const live = entries.filter((e) => !e.sold);

  return (
    <div className="card">
      <h2>Your listings</h2>
      <p className="muted">
        {live.length} still for sale. Saved on this device only — your phone and
        your laptop keep separate lists.
      </p>

      {entries.map((entry) => (
        <div className={`ledger-item${entry.sold ? " sold" : ""}`} key={entry.id}>
          {entry.thumb ? (
            <img src={entry.thumb} alt="" />
          ) : (
            <div style={{ width: 48, height: 48, flexShrink: 0 }} />
          )}
          <div className="meta">
            <div className="name">{entry.name}</div>
            <div className="sub">
              ${entry.askingCad} ·{" "}
              {CHANNEL_IDS.filter((id) => entry.posted[id])
                .map((id) => CHANNELS[id].name)
                .join(", ") || "not posted yet"}
            </div>
            <div className="toggle-row" style={{ marginTop: 6 }}>
              {CHANNEL_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="toggle"
                  aria-pressed={entry.posted[id]}
                  onClick={() => onTogglePosted(entry.id, id)}
                >
                  {id === "facebook" ? "FB" : "Kijiji"}
                </button>
              ))}
              <button type="button" className="toggle" aria-pressed={entry.sold} onClick={() => onToggleSold(entry.id)}>
                Sold
              </button>
              <button type="button" className="toggle btn-danger" onClick={() => onRemove(entry.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
