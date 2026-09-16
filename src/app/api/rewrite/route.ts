import { NextResponse } from "next/server";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, describeError, MODEL } from "@/lib/anthropic";
import { ItemSchema, ListingCopySchema, type SellerContext } from "@/lib/types";
import { rewriteSystemPrompt, rewriteUserText } from "@/lib/prompt";
import { getItem, loadSettings, updateItem } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({ itemId: z.string().min(1), item: ItemSchema });

/**
 * Second pass: the seller fixed the facts, so only the listing text is redone.
 * No photos go over the wire here, which makes it fast enough to use freely.
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { itemId, item } = parsed.data;

  const stored = await getItem(itemId);
  if (!stored) return NextResponse.json({ error: "No such item." }, { status: 404 });

  const settings = await loadSettings();
  const context: SellerContext = {
    hint: stored.note,
    city: settings.city,
    pickupNote: settings.pickupNote,
  };

  try {
    const client = getClient();

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: rewriteSystemPrompt(),
      messages: [{ role: "user", content: rewriteUserText(item, context) }],
      // Pure copywriting from settled facts — it does not need the full
      // reasoning budget that judging a photo does.
      output_config: { effort: "medium", format: zodOutputFormat(ListingCopySchema) },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model declined to write this listing." },
        { status: 422 },
      );
    }

    const copy = response.parsed_output;
    if (!copy) {
      return NextResponse.json(
        { error: "The model's reply did not match the expected shape. Try again." },
        { status: 502 },
      );
    }

    const saved = await updateItem(itemId, { draft: { item, copy } });
    return NextResponse.json({ item: saved });
  } catch (err) {
    const failure = describeError(err);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
