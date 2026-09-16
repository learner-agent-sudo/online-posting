import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, describeError, MODEL } from "@/lib/anthropic";
import { AnalyzeRequestSchema } from "@/lib/api-contract";
import { DraftSchema } from "@/lib/types";
import { analysisSystemPrompt, analysisUserText } from "@/lib/prompt";
import { lookupIsbn } from "@/lib/books";
import type { BookFacts } from "@/lib/books";

export const runtime = "nodejs";
// Photo analysis with thinking on can take a while; do not let the platform
// cut it off at the default 15s.
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = AnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { photos, context } = parsed.data;

  try {
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
                media_type: photo.media_type,
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

    return NextResponse.json({ draft, enrichment });
  } catch (err) {
    const failure = describeError(err);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
