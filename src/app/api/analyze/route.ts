import { NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, describeError, MODEL } from "@/lib/anthropic";
import { DraftSchema, type SellerContext } from "@/lib/types";
import { analysisSystemPrompt, analysisUserText } from "@/lib/prompt";
import { lookupIsbn } from "@/lib/books";
import type { BookFacts } from "@/lib/books";
import { getItem, loadSettings, readPhotosAsBase64, updateItem } from "@/lib/store";

export const runtime = "nodejs";
// Photo analysis with thinking on can take a while; do not let the platform
// cut it off at the default 15s.
export const maxDuration = 120;

const RequestSchema = z.object({ itemId: z.string().min(1) });

/**
 * Reads photos back off the laptop's disk rather than taking them in the
 * request, so the phone is free the moment it has finished uploading.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const item = await getItem(parsed.data.itemId);
  if (!item) return NextResponse.json({ error: "No such item." }, { status: 404 });
  if (item.photos.length === 0) {
    return NextResponse.json({ error: "That item has no photos." }, { status: 400 });
  }

  const settings = await loadSettings();
  const context: SellerContext = {
    hint: item.note,
    city: settings.city,
    pickupNote: settings.pickupNote,
  };

  try {
    const photos = await readPhotosAsBase64(item);
    const client = getClient();

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: analysisSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            ...photos.map((photo) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: photo.media_type as "image/jpeg",
                data: photo.data,
              },
            })),
            { type: "text" as const, text: analysisUserText(context, photos.length) },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(DraftSchema) },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to describe these photos. Try different ones." },
        { status: 422 },
      );
    }

    const draft = response.parsed_output;
    if (!draft) {
      return NextResponse.json(
        { error: "The model's reply did not match the expected shape. Try again." },
        { status: 502 },
      );
    }

    // Bonus pass for books. Never allowed to fail the request.
    let enrichment: BookFacts | null = null;
    if (draft.item.kind === "book" && draft.item.book?.isbn) {
      enrichment = await lookupIsbn(draft.item.book.isbn);
      if (enrichment && draft.item.book) {
        draft.item.book.title ??= enrichment.title;
        draft.item.book.author ??= enrichment.authors[0] ?? null;
      }
    }

    const saved = await updateItem(item.id, { draft });
    return NextResponse.json({ item: saved, enrichment });
  } catch (err) {
    const failure = describeError(err);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
