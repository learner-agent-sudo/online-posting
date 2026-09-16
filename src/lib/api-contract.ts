import { z } from "zod";
import { DraftSchema, ItemSchema } from "./types";

/** Request and response shapes shared by the routes and the browser. */

export const MAX_PHOTOS = 10;

/** Roughly 6 MB of base64 across all photos, i.e. ~4.5 MB of actual image. */
const MAX_TOTAL_BASE64 = 6_000_000;

export const PhotoSchema = z.object({
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  /** Base64 payload only — no `data:` prefix. */
  data: z.string().min(1),
});

export type Photo = z.infer<typeof PhotoSchema>;

export const SellerContextSchema = z.object({
  hint: z.string().max(2000),
  city: z.string().max(120),
  pickupNote: z.string().max(500),
});

export const AnalyzeRequestSchema = z
  .object({
    photos: z.array(PhotoSchema).min(1).max(MAX_PHOTOS),
    context: SellerContextSchema,
  })
  .refine(
    (body) => body.photos.reduce((n, p) => n + p.data.length, 0) <= MAX_TOTAL_BASE64,
    { message: "Photos are too large in total. Remove one and try again." },
  );

export const RewriteRequestSchema = z.object({
  item: ItemSchema,
  context: SellerContextSchema,
});

export const BookFactsSchema = z.object({
  title: z.string().nullable(),
  authors: z.array(z.string()),
  publisher: z.string().nullable(),
  publishDate: z.string().nullable(),
  pages: z.number().nullable(),
  subjects: z.array(z.string()),
});

export const AnalyzeResponseSchema = z.object({
  draft: DraftSchema,
  /** Present only when an ISBN was readable and Open Library answered. */
  enrichment: BookFactsSchema.nullable(),
});

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export interface ErrorResponse {
  error: string;
}
