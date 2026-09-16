import { test } from "node:test";
import assert from "node:assert/strict";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DraftSchema, ItemSchema, ListingCopySchema } from "./types.ts";

/**
 * Structured outputs are strict: the API rejects a schema whose objects allow
 * extra properties or leave a property out of `required`. Zod's `.optional()`
 * produces exactly that, and the failure only shows up as a 400 on the first
 * real call. These tests catch it here instead.
 */

interface JsonSchemaNode {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  $defs?: Record<string, JsonSchemaNode>;
  [key: string]: unknown;
}

function schemaOf(zodSchema: Parameters<typeof zodOutputFormat>[0]): JsonSchemaNode {
  const format = zodOutputFormat(zodSchema) as unknown as { schema: JsonSchemaNode };
  return format.schema;
}

/** Walks every object node, including those behind $defs and anyOf. */
function eachObject(node: JsonSchemaNode, visit: (node: JsonSchemaNode, path: string) => void, path = "$") {
  if (!node || typeof node !== "object") return;
  if (node.type === "object" && node.properties) visit(node, path);

  for (const [key, child] of Object.entries(node.properties ?? {})) {
    eachObject(child, visit, `${path}.${key}`);
  }
  for (const [key, child] of Object.entries(node.$defs ?? {})) {
    eachObject(child, visit, `${path}#${key}`);
  }
  if (node.items) eachObject(node.items, visit, `${path}[]`);
  for (const [index, child] of (node.anyOf ?? []).entries()) {
    eachObject(child, visit, `${path}|${index}`);
  }
}

test("zodOutputFormat produces a schema at all", () => {
  const schema = schemaOf(DraftSchema);
  assert.equal(schema.type, "object");
  assert.ok(schema.properties?.item, "item branch missing");
  assert.ok(schema.properties?.copy, "copy branch missing");
});

test("every object in the draft schema forbids extra properties", () => {
  eachObject(schemaOf(DraftSchema), (node, path) => {
    assert.equal(node.additionalProperties, false, `${path} allows extra properties`);
  });
});

test("every property is required — no optionals sneaked in", () => {
  eachObject(schemaOf(DraftSchema), (node, path) => {
    const declared = Object.keys(node.properties ?? {}).sort();
    const required = [...(node.required ?? [])].sort();
    assert.deepEqual(required, declared, `${path} has optional properties`);
  });
});

test("absent values are expressed as nullable, not omitted", () => {
  const item = schemaOf(ItemSchema);
  const brand = item.properties?.brand;
  const asJson = JSON.stringify(brand);
  assert.match(asJson, /null/, "brand should accept null");
});

test("the copy schema carries both channels plus keywords", () => {
  const copy = schemaOf(ListingCopySchema);
  for (const field of [
    "facebook_title",
    "facebook_description",
    "kijiji_title",
    "kijiji_description",
    "keywords",
  ]) {
    assert.ok(copy.properties?.[field], `missing ${field}`);
  }
});

test("a well-formed model reply parses back out", () => {
  const reply = {
    item: {
      kind: "book",
      name: "Dune, paperback",
      brand: null,
      model: null,
      colour: null,
      materials: ["paper"],
      dimensions: null,
      book: {
        title: "Dune",
        author: "Frank Herbert",
        isbn: "9780441013593",
        format: "paperback",
        edition: null,
        language: "English",
      },
      condition: "good",
      flaws: ["creased spine"],
      highlights: ["classic edition"],
      included: [],
      quantity: 1,
      price: { asking_cad: 8, low_cad: 5, high_cad: 12, rationale: "Common paperback." },
      needs_from_seller: [],
      confidence: "high",
    },
    copy: {
      facebook_title: "Dune by Frank Herbert, paperback",
      facebook_description: "Paperback copy of Dune.",
      kijiji_title: "Dune Frank Herbert paperback",
      kijiji_description: "Paperback copy of Dune, readable condition.",
      keywords: ["dune", "herbert", "scifi", "paperback", "book"],
    },
  };
  assert.doesNotThrow(() => DraftSchema.parse(reply));
});

test("a reply missing a required field is rejected rather than half-accepted", () => {
  const broken = { item: { kind: "book" }, copy: {} };
  assert.throws(() => DraftSchema.parse(broken));
});
