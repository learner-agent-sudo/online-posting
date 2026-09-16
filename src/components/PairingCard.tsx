"use client";

import { useEffect, useState } from "react";

interface Pairing {
  url: string | null;
  qr: string | null;
  reason: string | null;
}

/** The QR the phone scans to join. Collapsed once you have paired once. */
export default function PairingCard() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/pairing")
      .then((res) => res.json() as Promise<Pairing>)
      .then(setPairing)
      .catch(() => setPairing({ url: null, qr: null, reason: "Could not work out this machine's address." }));
  }, []);

  if (!pairing) return null;

  return (
    <div className="card">
      <div className="field-head">
        <h2 style={{ margin: 0 }}>Phone</h2>
        <button className="btn-small" type="button" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show QR code"}
        </button>
      </div>

      {!pairing.url && <p className="help">{pairing.reason}</p>}

      {pairing.url && !open && (
        <p className="help" style={{ marginTop: 6 }}>
          Camera app → scan the QR code → take photos. They appear below.
        </p>
      )}

      {pairing.url && open && (
        <>
          <p className="muted" style={{ marginTop: 10 }}>
            Point the phone&apos;s camera at this. It has to be on the same wifi as
            this laptop, and this app has to stay running.
          </p>
          {pairing.qr && (
            <div
              className="qr"
              aria-label={`QR code for ${pairing.url}`}
              dangerouslySetInnerHTML={{ __html: pairing.qr }}
            />
          )}
          <p className="help" style={{ textAlign: "center", wordBreak: "break-all" }}>
            {pairing.url}
          </p>
        </>
      )}
    </div>
  );
}
