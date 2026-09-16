"use client";

import { useState } from "react";
import { CONDITIONS, CONDITION_LABELS, type Condition, type Item } from "@/lib/types";
import type { BookFacts } from "@/lib/books";
import CompsCard from "./CompsCard";
import type { Comps } from "@/lib/types";

interface Props {
  item: Item;
  onChange: (item: Item) => void;
  enrichment: BookFacts | null;
  onRegenerate: () => void;
  regenerating: boolean;
  comps: Comps | null;
  researching: boolean;
  onResearch: () => void;
  mentionComps: boolean;
  onToggleMentionComps: (value: boolean) => void;
}

/** Editable list of short strings — flaws, included bits, selling points. */
function ChipEditor({
  label,
  help,
  values,
  onChange,
}: {
  label: string;
  help?: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const value = draft.trim();
    if (!value) return;
    onChange([...values, value]);
    setDraft("");
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <label>{label}</label>
      {values.length > 0 && (
        <div className="chip-list">
          {values.map((value, index) => (
            <span className="chip" key={`${value}-${index}`}>
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row">
        <input
          type="text"
          value={draft}
          placeholder="Add one…"
          style={{ marginBottom: 0 }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" style={{ flex: "0 0 auto" }} onClick={add}>
          Add
        </button>
      </div>
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export default function ReviewForm({
  item,
  onChange,
  enrichment,
  onRegenerate,
  regenerating,
  comps,
  researching,
  onResearch,
  mentionComps,
  onToggleMentionComps,
}: Props) {
  function patch(changes: Partial<Item>) {
    onChange({ ...item, ...changes });
  }

  function patchDimension(key: "width_cm" | "depth_cm" | "height_cm", raw: string) {
    const value = raw === "" ? null : Number(raw);
    if (value !== null && Number.isNaN(value)) return;
    const current = item.dimensions ?? {
      width_cm: null,
      depth_cm: null,
      height_cm: null,
      measured: true,
    };
    // The seller typing a number makes it a real measurement, not a guess.
    patch({ dimensions: { ...current, [key]: value, measured: true } });
  }

  const d = item.dimensions;

  return (
    <>
      {item.needs_from_seller.length > 0 && (
        <div className="notice">
          <strong>Only you can answer these</strong>
          <ul>
            {item.needs_from_seller.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      {item.confidence === "low" && (
        <div className="notice">
          The photos were hard to read, so check every field below before you post.
        </div>
      )}

      {enrichment && (
        <div className="notice">
          <strong>Found on Open Library</strong>
          <ul>
            {enrichment.title && <li>{enrichment.title}</li>}
            {enrichment.authors.length > 0 && <li>{enrichment.authors.join(", ")}</li>}
            {enrichment.publisher && (
              <li>
                {enrichment.publisher}
                {enrichment.publishDate ? `, ${enrichment.publishDate}` : ""}
              </li>
            )}
            {enrichment.pages && <li>{enrichment.pages} pages</li>}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>
          The item <span className="pill">{item.kind}</span>{" "}
          {item.confidence !== "high" && (
            <span className={`pill ${item.confidence === "low" ? "low" : ""}`}>
              {item.confidence} confidence
            </span>
          )}
        </h2>

        <label htmlFor="name">What it is</label>
        <input
          id="name"
          type="text"
          value={item.name}
          onChange={(e) => patch({ name: e.target.value })}
        />

        <div className="row">
          <div>
            <label htmlFor="brand">Brand</label>
            <input
              id="brand"
              type="text"
              value={item.brand ?? ""}
              placeholder="Unknown"
              onChange={(e) => patch({ brand: e.target.value || null })}
            />
          </div>
          <div>
            <label htmlFor="colour">Colour</label>
            <input
              id="colour"
              type="text"
              value={item.colour ?? ""}
              placeholder="—"
              onChange={(e) => patch({ colour: e.target.value || null })}
            />
          </div>
        </div>

        <label htmlFor="condition">Condition</label>
        <select
          id="condition"
          value={item.condition}
          onChange={(e) => patch({ condition: e.target.value as Condition })}
        >
          {CONDITIONS.map((condition) => (
            <option key={condition} value={condition}>
              {CONDITION_LABELS[condition]}
            </option>
          ))}
        </select>

        {item.book && (
          <>
            <label htmlFor="book-title">Book title</label>
            <input
              id="book-title"
              type="text"
              value={item.book.title ?? ""}
              onChange={(e) =>
                patch({ book: { ...item.book!, title: e.target.value || null } })
              }
            />
            <div className="row">
              <div>
                <label htmlFor="book-author">Author</label>
                <input
                  id="book-author"
                  type="text"
                  value={item.book.author ?? ""}
                  onChange={(e) =>
                    patch({ book: { ...item.book!, author: e.target.value || null } })
                  }
                />
              </div>
              <div>
                <label htmlFor="book-isbn">ISBN</label>
                <input
                  id="book-isbn"
                  type="text"
                  inputMode="numeric"
                  value={item.book.isbn ?? ""}
                  onChange={(e) =>
                    patch({ book: { ...item.book!, isbn: e.target.value || null } })
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Price</h2>
        <label htmlFor="price">Asking price (CAD)</label>
        <input
          id="price"
          type="number"
          inputMode="decimal"
          min={0}
          value={item.price.asking_cad}
          onChange={(e) =>
            patch({ price: { ...item.price, asking_cad: Number(e.target.value) || 0 } })
          }
        />
        <p className="help">
          Estimated range ${item.price.low_cad}–${item.price.high_cad}. {item.price.rationale}
        </p>
        <p className="help">
          A guess from the photos. The price lookup below checks what comparable
          ones are actually listed at right now.
        </p>
      </div>

      <CompsCard
        comps={comps}
        askingCad={item.price.asking_cad}
        researching={researching}
        onResearch={onResearch}
        onUsePrice={(price) => patch({ price: { ...item.price, asking_cad: price } })}
        mentionInListing={mentionComps}
        onToggleMention={onToggleMentionComps}
      />

      <div className="card">
        <h2>Details</h2>

        <label>Dimensions (cm)</label>
        <div className="row">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Width"
            aria-label="Width in cm"
            value={d?.width_cm ?? ""}
            onChange={(e) => patchDimension("width_cm", e.target.value)}
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Depth"
            aria-label="Depth in cm"
            value={d?.depth_cm ?? ""}
            onChange={(e) => patchDimension("depth_cm", e.target.value)}
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="Height"
            aria-label="Height in cm"
            value={d?.height_cm ?? ""}
            onChange={(e) => patchDimension("height_cm", e.target.value)}
          />
        </div>
        <p className="help">
          {d && !d.measured
            ? "Estimated from the photos — measure it, buyers ask every time."
            : "Buyers ask for these before anything else."}
        </p>

        <ChipEditor
          label="Flaws worth mentioning"
          help="Naming them up front prevents the pickup that falls apart at the door."
          values={item.flaws}
          onChange={(flaws) => patch({ flaws })}
        />
        <ChipEditor
          label="Selling points"
          values={item.highlights}
          onChange={(highlights) => patch({ highlights })}
        />
        <ChipEditor
          label="Included with it"
          values={item.included}
          onChange={(included) => patch({ included })}
        />
      </div>

      <div className="card">
        <h2>Listing text</h2>
        <p className="muted">
          Changed something above? Rewrite the text so it matches before you post.
        </p>
        <button type="button" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? (
            <>
              <span className="spinner" />
              Rewriting
            </>
          ) : (
            "Rewrite the listing text"
          )}
        </button>
      </div>
    </>
  );
}
