import { z } from "zod";

/** Shapes shared by the routes and the browser. */

export const MAX_PHOTOS = 10;

export const PhotoSchema = z.object({
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  /** Base64 payload only — no `data:` prefix. */
  data: z.string().min(1),
});

export type Photo = z.infer<typeof PhotoSchema>;

export interface ErrorResponse {
  error: string;
}
