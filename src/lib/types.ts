import { z } from "zod";

/**
 * The canonical item. Every channel is a projection of this, so adding a site
 * later means writing one mapping function rather than touching the pipeline.
 *
 * Structured outputs are strict: every field is required and absent values are
 * `null` rather than omitted. Making fields `.optional()` here would generate a
 * JSON schema the API rejects.
 */

export const CONDITIONS = [
  "new",
  "like-new",
  "good",
  "fair",
  "for-parts",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  new: "New / never used",
  "like-new": "Like new",
  good: "Good — normal signs of use",
  fair: "Fair — visible wear",
  "for-parts": "For parts or repair",
};

export const ITEM_KINDS = ["book", "furniture", "other"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const DimensionsSchema = z.object({
  width_cm: z.number().nullable(),
  depth_cm: z.number().nullable(),
  height_cm: z.number().nullable(),
  /** True when the model read a tape measure or label; false when it guessed. */
  measured: z.boolean(),
});

export const BookDetailsSchema = z.object({
  title: z.string().nullable(),
  author: z.string().nullable(),
  /** Digits only, no hyphens. 10 or 13 characters. */
  isbn: z.string().nullable(),
  format: z.enum(["hardcover", "paperback", "boxset", "unknown"]),
  edition: z.string().nullable(),
  language: z.string().nullable(),
});

export const PriceSchema = z.object({
  /** Canadian dollars. `asking` is what goes in the listing field. */
  asking_cad: z.number(),
  low_cad: z.number(),
  high_cad: z.number(),
  /** One sentence the seller can actually read and sanity-check. */
  rationale: z.string(),
});

export const ItemSchema = z.object({
  kind: z.enum(ITEM_KINDS),
  /** Plain name of the thing, e.g. "IKEA Billy bookcase, white". */
  name: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  colour: z.string().nullable(),
  materials: z.array(z.string()),
  dimensions: DimensionsSchema.nullable(),
  book: BookDetailsSchema.nullable(),
  condition: z.enum(CONDITIONS),
  /** Specific, honest wear notes. Buyers forgive flaws they were told about. */
  flaws: z.array(z.string()),
  /** Selling points worth putting near the top of the description. */
  highlights: z.array(z.string()),
  /** Anything bundled in: cushions, hardware, matching chairs. */
  included: z.array(z.string()),
  quantity: z.number().int(),
  price: PriceSchema,
  /**
   * Questions the photos could not answer. Shown to the seller as a short
   * checklist. Better than silently inventing dimensions.
   */
  needs_from_seller: z.array(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
});

export type Item = z.infer<typeof ItemSchema>;
export type Dimensions = z.infer<typeof DimensionsSchema>;
export type BookDetails = z.infer<typeof BookDetailsSchema>;
export type Price = z.infer<typeof PriceSchema>;

/** Per-channel listing text, already trimmed to that site's limits. */
export const ListingCopySchema = z.object({
  facebook_title: z.string(),
  facebook_description: z.string(),
  kijiji_title: z.string(),
  kijiji_description: z.string(),
  /** Search words a buyer would actually type. Used for Kijiji's tag field. */
  keywords: z.array(z.string()),
});

export type ListingCopy = z.infer<typeof ListingCopySchema>;

export const DraftSchema = z.object({
  item: ItemSchema,
  copy: ListingCopySchema,
});

export type Draft = z.infer<typeof DraftSchema>;

/** What the seller types in before analysis. All of it is optional. */
export interface SellerContext {
  hint: string;
  city: string;
  pickupNote: string;
}

export const DEFAULT_SELLER_CONTEXT: SellerContext = {
  hint: "",
  city: "",
  pickupNote: "",
};
