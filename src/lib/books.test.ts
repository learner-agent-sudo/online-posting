import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIsbn } from "./books.ts";

test("hyphens and spaces come out of an ISBN", () => {
  assert.equal(normalizeIsbn("978-0-441-01359-3"), "9780441013593");
  assert.equal(normalizeIsbn("0 441 01359 8"), "0441013598");
});

test("an ISBN-10 ending in X keeps the check digit", () => {
  assert.equal(normalizeIsbn("043942089x"), "043942089X");
});

test("anything that is not 10 or 13 digits is refused", () => {
  assert.equal(normalizeIsbn("12345"), null);
  assert.equal(normalizeIsbn("97804410135931234"), null);
  assert.equal(normalizeIsbn(""), null);
  assert.equal(normalizeIsbn(null), null);
});

test("a price misread as an ISBN does not sneak through", () => {
  assert.equal(normalizeIsbn("$19.99"), null);
});
