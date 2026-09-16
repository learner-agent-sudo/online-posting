"use client";

import type { Comps } from "@/lib/types";

interface Props {
  comps: Comps | null;
  askingCad: number;
  researching: boolean;
  onResearch: () => void;
  onUsePrice: (price: number) => void;
  mentionInListing: boolean;
  onToggleMention: (value: boolean) => void;
}

const CONFIDENCE_NOTE: Record<Comps["confidence"], string> = {
  high: "Several genuinely comparable Canadian listings.",
  medium: "Some comparable listings, but not many.",
  low: "Thin evidence — treat this as a hint, not a number.",
};

export default function CompsCard({
  comps,
  askingCad,
  researching,
  onResearch,
  onUsePrice,
  mentionInListing,
  onToggleMention,
}: Props) {
  return (
    <div className="card">
      <h2>What similar ones are going for</h2>

      {!comps && (
        <>
          <p className="muted">
            Searches the live web for this item used in Ontario and shows you what
            people are asking, with links. Costs a few cents and takes a minute.
          </p>
          <button type="button" onClick={onResearch} disabled={researching}>
            {researching ? (
              <>
                <span className="spinner" />
                Searching…
              </>
            ) : (
              "Look up prices"
            )}
          </button>
        </>
      )}

      {comps && (
        <>
          <div className="price-range">
            <div>
              <div className="price-range-value">
                ${comps.low_cad}–${comps.high_cad}
              </div>
              <div className="help" style={{ margin: 0 }}>
                asking prices found · typically ${comps.typical_cad}
              </div>
            </div>
            <span className={`pill ${comps.confidence === "low" ? "low" : ""}`}>
              {comps.confidence} confidence
            </span>
          </div>

          <p style={{ marginTop: 12 }}>{comps.summary}</p>
          <p className="help">{CONFIDENCE_NOTE[comps.confidence]}</p>

          {comps.examples.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>What it found</h3>
              <ul className="comps-list">
                {comps.examples.map((example, index) => (
                  <li key={`${example.url}-${index}`}>
                    <a href={example.url} target="_blank" rel="noopener noreferrer">
                      {example.label}
                    </a>
                    <span className="comps-price">
                      ${example.price_cad} · {example.where}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="help">
            These are asking prices on listings that are still up, not sold
            prices. The overpriced ones are exactly the ones still sitting there,
            so the top of the range is optimistic.
          </p>

          <div className="btn-row" style={{ marginTop: 12 }}>
            {comps.typical_cad !== askingCad && (
              <button type="button" onClick={() => onUsePrice(comps.typical_cad)}>
                Use ${comps.typical_cad} as my price
              </button>
            )}
            <button type="button" onClick={onResearch} disabled={researching}>
              {researching ? (
                <>
                  <span className="spinner" />
                  Searching…
                </>
              ) : (
                "Search again"
              )}
            </button>
          </div>

          <label className="checkbox-row" htmlFor="mention-comps">
            <input
              id="mention-comps"
              type="checkbox"
              checked={mentionInListing}
              onChange={(e) => onToggleMention(e.target.checked)}
            />
            <span>
              Mention the range in the listing itself
              <span className="help" style={{ display: "block", margin: 0 }}>
                I would leave this off. Buyers do not care what others are asking,
                and quoting a range invites them to haggle to the bottom of it.
              </span>
            </span>
          </label>
        </>
      )}
    </div>
  );
}
