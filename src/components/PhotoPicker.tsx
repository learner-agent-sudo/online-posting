"use client";

import { useRef, useState } from "react";
import { MAX_PHOTOS } from "@/lib/api-contract";
import { formatBytes, preparePhoto, type PreparedPhoto } from "@/lib/photos";

interface Props {
  photos: PreparedPhoto[];
  onChange: (photos: PreparedPhoto[]) => void;
  onError: (message: string) => void;
}

export default function PhotoPicker({ photos, onChange, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      onError(`${MAX_PHOTOS} photos is the limit on both sites.`);
      return;
    }

    setBusy(true);
    const accepted: PreparedPhoto[] = [];
    let rejected = 0;

    for (const file of Array.from(fileList).slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        rejected += 1;
        continue;
      }
      try {
        accepted.push(await preparePhoto(file));
      } catch {
        rejected += 1;
      }
    }

    setBusy(false);
    if (accepted.length > 0) onChange([...photos, ...accepted]);
    if (rejected > 0) onError(`${rejected} file${rejected === 1 ? "" : "s"} could not be read.`);
    if (fileList.length > room) onError(`Only the first ${room} were added — ${MAX_PHOTOS} is the limit.`);
  }

  function remove(id: string) {
    const target = photos.find((p) => p.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(photos.filter((p) => p.id !== id));
  }

  const totalBytes = photos.reduce((n, p) => n + p.bytes, 0);
  const originalBytes = photos.reduce((n, p) => n + p.originalBytes, 0);

  return (
    <div className="card">
      <h2>Photos</h2>
      <p className="muted">
        First photo is the one buyers see in the grid, so make it the whole item in
        good light. Location data is stripped from every photo before it leaves
        this phone.
      </p>

      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <div className="photo-tile" key={photo.id}>
              <img src={photo.previewUrl} alt={`Photo ${index + 1}`} />
              <span className="badge">{index === 0 ? "Cover" : index + 1}</span>
              <button
                className="remove"
                type="button"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => remove(photo.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy}>
          {busy ? <><span className="spinner" />Working</> : "Take photo"}
        </button>
        <button type="button" onClick={() => libraryRef.current?.click()} disabled={busy}>
          Choose photos
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {photos.length > 0 && (
        <p className="help">
          {photos.length} photo{photos.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}{" "}
          (down from {formatBytes(originalBytes)})
        </p>
      )}
    </div>
  );
}
