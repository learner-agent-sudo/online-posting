import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient, describeError, MODEL } from "@/lib/anthropic";
import { CompsFindingsSchema, type Comps } from "@/lib/types";
import {
  compsExtractSystemPrompt,
  compsSearchSystemPrompt,
  compsSearchUserText,
} from "@/lib/prompt";
import { getItem, loadSettings, readPhotosAsBase64, updateItem } from "@/lib/store";

export const runtime = "nodejs";
// Several live searches plus two model passes. Give it room.
export const maxDuration = 180;

const RequestSchema = z.object({ itemId: z.string().min(1) });

/** Photos to send along so the model can tell near-identical models apart. */
const PHOTOS_FOR_SEARCH = 2;
const MAX_SEARCHES = 6;
/** A paused turn is resumed, not restarted. Bounded so it cannot spin. */
const MAX_CONTINUATIONS = 3;

interface Harvest {
  text: string;
  sources: { title: string; url: string }[];
}

/** Pull the prose and the pages it came from out of the response content. */
function harvest(content: Anthropic.ContentBlock[]): Harvest {
  const text: string[] = [];
  const sources: { title: string; url: string }[] = [];

  for (const block of content) {
    if (block.type === "text") {
      text.push(block.text);
      continue;
    }
    if (block.type !== "web_search_tool_result") continue;

    // A successful result is a list of pages; a failure is a single error
    // object on the same field, and it arrives as HTTP 200 either way.
    if (!Array.isArray(block.content)) continue;
    for (const result of block.content) {
      if (result.type === "web_search_result") {
        sources.push({ title: result.title, url: result.url });
      }
    }
  }

  return { text: text.join("\n").trim(), sources };
}

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

  const stored = await getItem(parsed.data.itemId);
  if (!stored) return NextResponse.json({ error: "No such item." }, { status: 404 });
  if (!stored.draft) {
    return NextResponse.json(
      { error: "Write the listing first — the search needs to know what the thing is." },
      { status: 400 },
    );
  }

  const settings = await loadSettings();
  const item = stored.draft.item;
  // "Mississauga, ON" -> "Mississauga", which is what the location hint wants.
  const city = settings.city.split(",")[0]?.trim() ?? "";

  try {
    const client = getClient();
    const photos = (await readPhotosAsBase64(stored)).slice(0, PHOTOS_FOR_SEARCH);

    const messages: Anthropic.MessageParam[] = [
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
          { type: "text" as const, text: compsSearchUserText(item, city) },
        ],
      },
    ];

    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: compsSearchSystemPrompt(),
      messages,
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: MAX_SEARCHES,
          user_location: {
            type: "approximate",
            country: "CA",
            region: "Ontario",
            ...(city ? { city } : {}),
          },
        },
      ],
    });

    // Long server-tool turns come back paused; hand the turn straight back.
    for (let i = 0; i < MAX_CONTINUATIONS && response.stop_reason === "pause_turn"; i += 1) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: compsSearchSystemPrompt(),
        messages,
        tools: [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: MAX_SEARCHES,
            user_location: {
              type: "approximate",
              country: "CA",
              region: "Ontario",
              ...(city ? { city } : {}),
            },
          },
        ],
      });
    }

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "The model declined this search." }, { status: 422 });
    }

    const found = harvest(response.content);
    if (!found.text) {
      return NextResponse.json(
        { error: "The search came back empty. Try again, or price it yourself." },
        { status: 502 },
      );
    }

    // Second pass turns the prose into numbers. Kept separate from the search
    // so each request uses one well-understood feature rather than stacking
    // structured output on top of a server tool.
    const structured = await client.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: compsExtractSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            `Item: ${item.name} (condition: ${item.condition})`,
            "",
            "Research notes:",
            found.text,
            "",
            "Pages consulted:",
            ...found.sources.map((s) => `- ${s.title} — ${s.url}`),
          ].join("\n"),
        },
      ],
      output_config: { effort: "low", format: zodOutputFormat(CompsFindingsSchema) },
    });

    const findings = structured.parsed_output;
    if (!findings) {
      return NextResponse.json(
        { error: "Could not make sense of the search results. Try again." },
        { status: 502 },
      );
    }

    const comps: Comps = { ...findings, searchedAt: new Date().toISOString() };
    const saved = await updateItem(stored.id, { comps });
    return NextResponse.json({ item: saved });
  } catch (err) {
    const failure = describeError(err);
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
