import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildDescription,
  buildPack,
  buildTitle,
  categoryFor,
  conditionFor,
  formatDimensions,
} from "./channels.ts";
import type { Item, ListingCopy, SellerContext } from "./types.ts";

const context: SellerContext = {
  hint: "",
  city: "Mississauga, ON",
  pickupNote: "Near Hurontario & Eglinton.",
};

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    kind: "furniture",
    name: "IKEA Billy bookcase, white",
    brand: "IKEA",
    model: "Billy",
    colour: "white",
    materials: ["particleboard"],
    dimensions: { width_cm: 80, depth_cm: 28, height_cm: 202, measured: true },
    book: null,
    condition: "good",
    flaws: ["small chip on the bottom shelf"],
    highlights: ["adjustable shelves"],
    included: ["all shelf pegs"],
    quantity: 1,
    price: {
      asking_cad: 45,
      low_cad: 30,
      high_cad: 60,
      rationale: "Assembled flat-pack shelving in good shape.",
    },
    needs_from_seller: [],
    confidence: "high",
    ...overrides,
  };
}

const copy: ListingCopy = {
  facebook_title: "IKEA Billy bookcase, white, 80cm wide",
  facebook_description: "Classic white Billy.\nShelves adjust.\nAlready assembled.",
  kijiji_title: "IKEA Billy bookcase white 80cm",
  kijiji_description: "Classic white IKEA Billy bookcase with adjustable shelves.",
  keywords: ["ikea", "billy", "bookcase", "shelving", "white"],
};

test("titles are cut to each site's limit at a word boundary", () => {
  const long = { ...copy, kijiji_title: "x".repeat(20) + " " + "y".repeat(80) };
  const title = buildTitle(makeItem(), long, "kijiji");
  assert.ok(title.length <= 64, `got ${title.length} chars`);
  assert.ok(title.endsWith("…"));
});

test("titles short enough are left exactly alone", () => {
  assert.equal(buildTitle(makeItem(), copy, "facebook"), copy.facebook_title);
});

test("description appends dimensions, included, flaws and pickup in that order", () => {
  const text = buildDescription(makeItem(), copy, context, "facebook");
  const order = ["Classic white Billy", "Dimensions:", "Included:", "Condition notes:", "Pickup in Mississauga"];
  let cursor = -1;
  for (const marker of order) {
    const found = text.indexOf(marker);
    assert.ok(found > cursor, `${marker} is out of order`);
    cursor = found;
  }
  assert.match(text, /No shipping or delivery/);
});

test("for-parts items say so in the description", () => {
  const text = buildDescription(makeItem({ condition: "for-parts" }), copy, context, "kijiji");
  assert.match(text, /for parts or repair/i);
});

test("an item with nothing to declare still gets the pickup block", () => {
  const bare = makeItem({ flaws: [], included: [], dimensions: null });
  const text = buildDescription(bare, copy, context, "facebook");
  assert.doesNotMatch(text, /Dimensions:|Included:|Condition notes:/);
  assert.match(text, /Pickup in Mississauga/);
});

test("estimated dimensions are flagged as approximate", () => {
  const guessed = makeItem({
    dimensions: { width_cm: 80, depth_cm: null, height_cm: 202, measured: false },
  });
  assert.match(formatDimensions(guessed)!, /approximate/);
  assert.doesNotMatch(formatDimensions(makeItem())!, /approximate/);
});

test("dimensions with no numbers produce nothing rather than an empty label", () => {
  const empty = makeItem({
    dimensions: { width_cm: null, depth_cm: null, height_cm: null, measured: false },
  });
  assert.equal(formatDimensions(empty), null);
});

test("furniture is routed by what it is, not just its kind", () => {
  assert.match(categoryFor(makeItem(), "kijiji"), /Bookcases & Shelving/);
  assert.match(categoryFor(makeItem({ name: "Grey sectional sofa" }), "kijiji"), /Couches & Futons/);
  assert.match(
    categoryFor(makeItem({ name: "Queen mattress and frame" }), "facebook"),
    /Bedroom Furniture/,
  );
});

test("unrecognised furniture falls back rather than throwing", () => {
  assert.match(categoryFor(makeItem({ name: "Wooden thing" }), "kijiji"), /Other Furniture/);
});

test("books route to the book category on both sites", () => {
  const book = makeItem({ kind: "book", name: "Dune, paperback" });
  assert.match(categoryFor(book, "facebook"), /Books/);
  assert.match(categoryFor(book, "kijiji"), /Books/);
});

test("Kijiji collapses every used grade to Used; Facebook keeps the detail", () => {
  assert.equal(conditionFor(makeItem({ condition: "like-new" }), "kijiji"), "Used");
  assert.equal(conditionFor(makeItem({ condition: "like-new" }), "facebook"), "Used – Like New");
  assert.equal(conditionFor(makeItem({ condition: "new" }), "kijiji"), "New");
});

test("the pack carries every field the form asks for", () => {
  const labels = buildPack(makeItem(), copy, context, "kijiji").map((f) => f.label);
  for (const expected of ["Title", "Price (CAD)", "Category", "Condition", "Description", "Location"]) {
    assert.ok(labels.includes(expected), `missing ${expected}`);
  }
  assert.ok(labels.includes("Keywords / tags"), "Kijiji should get the tags field");
});

test("Facebook does not get Kijiji's tags field", () => {
  const labels = buildPack(makeItem(), copy, context, "facebook").map((f) => f.label);
  assert.ok(!labels.includes("Keywords / tags"));
});

test("an empty city does not leave a dangling Location field", () => {
  const labels = buildPack(makeItem(), copy, { ...context, city: "" }, "facebook").map((f) => f.label);
  assert.ok(!labels.includes("Location"));
});
