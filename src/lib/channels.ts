import type { Comps, Condition, Item, ListingCopy, SellerContext } from "./types";

/**
 * Channel adapters.
 *
 * Caveat worth knowing: the category paths and field limits below are
 * best-effort. Neither Facebook nor Kijiji publishes a taxonomy for personal
 * listings, so these come from observation and drift when the sites change
 * their forms. They are a head start for the dropdowns, not gospel — if a path
 * does not exist any more, pick the nearest one and correct it here.
 */

export type ChannelId = "facebook" | "kijiji";

export interface ChannelField {
  label: string;
  value: string;
  /** Shown under the field as a short note. */
  hint?: string;
  /** Renders as a textarea with a copy button rather than a single line. */
  long?: boolean;
}

export interface Channel {
  id: ChannelId;
  name: string;
  createUrl: string;
  titleLimit: number;
  descriptionLimit: number;
  photoLimit: number;
}

export const CHANNELS: Record<ChannelId, Channel> = {
  facebook: {
    id: "facebook",
    name: "Facebook Marketplace",
    createUrl: "https://www.facebook.com/marketplace/create/item",
    titleLimit: 100,
    descriptionLimit: 5000,
    photoLimit: 10,
  },
  kijiji: {
    id: "kijiji",
    name: "Kijiji",
    createUrl: "https://www.kijiji.ca/p-post-ad.html",
    titleLimit: 64,
    descriptionLimit: 8000,
    photoLimit: 10,
  },
};

export const CHANNEL_IDS: ChannelId[] = ["facebook", "kijiji"];

const FACEBOOK_CONDITION: Record<Condition, string> = {
  new: "New",
  "like-new": "Used – Like New",
  good: "Used – Good",
  fair: "Used – Fair",
  // Facebook has no "for parts" option, so this lands on Fair and the
  // description carries the real story.
  "for-parts": "Used – Fair",
};

const KIJIJI_CONDITION: Record<Condition, string> = {
  new: "New",
  "like-new": "Used",
  good: "Used",
  fair: "Used",
  "for-parts": "Used",
};

interface CategoryRule {
  match: RegExp;
  facebook: string;
  kijiji: string;
}

const FURNITURE_RULES: CategoryRule[] = [
  {
    match: /\b(sofa|couch|loveseat|sectional|futon|chesterfield)\b/i,
    facebook: "Home & Garden → Furniture → Living Room Furniture",
    kijiji: "Buy & Sell → Furniture → Couches & Futons",
  },
  {
    match: /\b(bed|mattress|boxspring|box spring|headboard|bunk)\b/i,
    facebook: "Home & Garden → Furniture → Bedroom Furniture",
    kijiji: "Buy & Sell → Furniture → Beds & Mattresses",
  },
  {
    match: /\b(dresser|wardrobe|armoire|chest of drawers|nightstand)\b/i,
    facebook: "Home & Garden → Furniture → Bedroom Furniture",
    kijiji: "Buy & Sell → Furniture → Dressers & Wardrobes",
  },
  {
    match: /\b(bookcase|bookshelf|shelving|shelf|billy|etagere)\b/i,
    facebook: "Home & Garden → Furniture → Other Furniture",
    kijiji: "Buy & Sell → Furniture → Bookcases & Shelving",
  },
  {
    match: /\b(desk|workstation)\b/i,
    facebook: "Home & Garden → Furniture → Office Furniture",
    kijiji: "Buy & Sell → Furniture → Desks",
  },
  {
    match: /\b(coffee table|side table|end table|accent table)\b/i,
    facebook: "Home & Garden → Furniture → Living Room Furniture",
    kijiji: "Buy & Sell → Furniture → Coffee Tables",
  },
  {
    match: /\b(dining table|dining set|kitchen table)\b/i,
    facebook: "Home & Garden → Furniture → Dining Room Furniture",
    kijiji: "Buy & Sell → Furniture → Dining Tables & Sets",
  },
  {
    match: /\b(chair|recliner|stool|bench|ottoman)\b/i,
    facebook: "Home & Garden → Furniture → Living Room Furniture",
    kijiji: "Buy & Sell → Furniture → Chairs & Recliners",
  },
  {
    match: /\b(cabinet|hutch|sideboard|buffet|credenza|display case)\b/i,
    facebook: "Home & Garden → Furniture → Other Furniture",
    kijiji: "Buy & Sell → Furniture → Hutches & Display Cabinets",
  },
];

export function categoryFor(item: Item, channel: ChannelId): string {
  if (item.kind === "book") {
    return channel === "facebook"
      ? "Entertainment → Books, Movies & Music → Books"
      : "Buy & Sell → Books";
  }

  if (item.kind === "furniture") {
    const haystack = [item.name, ...item.highlights].join(" ");
    const rule = FURNITURE_RULES.find((r) => r.match.test(haystack));
    if (rule) return channel === "facebook" ? rule.facebook : rule.kijiji;
    return channel === "facebook"
      ? "Home & Garden → Furniture → Other Furniture"
      : "Buy & Sell → Furniture → Other Furniture";
  }

  return channel === "facebook"
    ? "Pick the closest match on the form"
    : "Buy & Sell → Other";
}

export function conditionFor(item: Item, channel: ChannelId): string {
  return channel === "facebook"
    ? FACEBOOK_CONDITION[item.condition]
    : KIJIJI_CONDITION[item.condition];
}

export function formatDimensions(item: Item): string | null {
  const d = item.dimensions;
  if (!d) return null;
  const parts = [
    d.width_cm ? `W ${d.width_cm} cm` : null,
    d.depth_cm ? `D ${d.depth_cm} cm` : null,
    d.height_cm ? `H ${d.height_cm} cm` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const suffix = d.measured ? "" : " (approximate — please confirm)";
  return parts.join(" × ") + suffix;
}

/**
 * The closing block of every description. Built from what the seller typed, not
 * from the model, so the pickup facts are always exactly what they said.
 */
function pickupBlock(ctx: SellerContext): string {
  const lines: string[] = [];
  if (ctx.city.trim()) lines.push(`Pickup in ${ctx.city.trim()}.`);
  if (ctx.pickupNote.trim()) lines.push(ctx.pickupNote.trim());
  lines.push("Cash or e-transfer on pickup. No shipping or delivery.");
  return lines.join(" ");
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  // Cut at a word boundary so the title does not end mid-word.
  const cut = text.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export interface PackOptions {
  comps?: Comps | null;
  /**
   * Whether the researched range goes into the public listing. Off by default:
   * buyers do not care what other people are asking, and quoting a range is an
   * invitation to haggle down to the bottom of it.
   */
  mentionComps?: boolean;
}

export function buildDescription(
  item: Item,
  copy: ListingCopy,
  ctx: SellerContext,
  channel: ChannelId,
  options: PackOptions = {},
): string {
  const body = channel === "facebook" ? copy.facebook_description : copy.kijiji_description;
  const blocks = [body.trim()];

  const dims = formatDimensions(item);
  if (dims) blocks.push(`Dimensions: ${dims}`);

  if (item.included.length > 0) blocks.push(`Included: ${item.included.join(", ")}`);

  if (item.flaws.length > 0) {
    blocks.push(
      `Condition notes: ${item.flaws.join("; ")}.` +
        (item.condition === "for-parts" ? " Sold as-is, for parts or repair." : ""),
    );
  }

  const comps = options.comps;
  if (options.mentionComps && comps && comps.confidence !== "low") {
    blocks.push(
      `Comparable ones are currently listed around $${comps.low_cad}–$${comps.high_cad}.`,
    );
  }

  blocks.push(pickupBlock(ctx));

  const joined = blocks.filter((b) => b.trim().length > 0).join("\n\n");
  return truncate(joined, CHANNELS[channel].descriptionLimit);
}

export function buildTitle(
  item: Item,
  copy: ListingCopy,
  channel: ChannelId,
): string {
  const raw = channel === "facebook" ? copy.facebook_title : copy.kijiji_title;
  return truncate(raw.trim(), CHANNELS[channel].titleLimit);
}

/** Everything the seller has to paste, in the order the real form asks for it. */
export function buildPack(
  item: Item,
  copy: ListingCopy,
  ctx: SellerContext,
  channel: ChannelId,
  options: PackOptions = {},
): ChannelField[] {
  const fields: ChannelField[] = [
    {
      label: "Title",
      value: buildTitle(item, copy, channel),
      hint: `${CHANNELS[channel].titleLimit} character limit`,
    },
    { label: "Price (CAD)", value: String(item.price.asking_cad), hint: item.price.rationale },
    { label: "Category", value: categoryFor(item, channel), hint: "Best guess — confirm on the form" },
    { label: "Condition", value: conditionFor(item, channel) },
    {
      label: "Description",
      value: buildDescription(item, copy, ctx, channel, options),
      long: true,
    },
  ];

  if (ctx.city.trim()) {
    fields.push({ label: "Location", value: ctx.city.trim() });
  }

  if (channel === "kijiji" && copy.keywords.length > 0) {
    fields.push({
      label: "Keywords / tags",
      value: copy.keywords.join(", "),
      hint: "Kijiji shows a tags field on some categories",
    });
  }

  return fields;
}
