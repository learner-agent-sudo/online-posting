/**
 * Book enrichment via Open Library. Free, no key, no rate-limit paperwork.
 *
 * This is a bonus pass, never a dependency: if it is slow or down we keep
 * whatever the photos told us. A book listing without publisher metadata is
 * still a fine book listing.
 */

export interface BookFacts {
  title: string | null;
  authors: string[];
  publisher: string | null;
  publishDate: string | null;
  pages: number | null;
  subjects: string[];
}

interface OpenLibraryEntry {
  title?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
  subjects?: { name?: string }[];
}

/** Digits only; the trailing check digit of an ISBN-10 may be an X. */
export function normalizeIsbn(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  return cleaned.length === 10 || cleaned.length === 13 ? cleaned : null;
}

export async function lookupIsbn(
  rawIsbn: string | null,
  timeoutMs = 4000,
): Promise<BookFacts | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;

  const url =
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}` +
    `&format=json&jscmd=data`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "ListKit/0.1 (personal listing helper)" },
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as Record<string, OpenLibraryEntry>;
    const entry = payload[`ISBN:${isbn}`];
    if (!entry) return null;

    return {
      title: entry.title ?? null,
      authors: (entry.authors ?? []).map((a) => a.name).filter((n): n is string => !!n),
      publisher: entry.publishers?.[0]?.name ?? null,
      publishDate: entry.publish_date ?? null,
      pages: entry.number_of_pages ?? null,
      subjects: (entry.subjects ?? [])
        .map((s) => s.name)
        .filter((n): n is string => !!n)
        .slice(0, 6),
    };
  } catch {
    // Timeout, DNS, malformed JSON — all the same to us. Carry on without it.
    return null;
  }
}

export function describeBookFacts(facts: BookFacts): string {
  const bits = [
    facts.title ? `Title: ${facts.title}` : null,
    facts.authors.length ? `Author(s): ${facts.authors.join(", ")}` : null,
    facts.publisher ? `Publisher: ${facts.publisher}` : null,
    facts.publishDate ? `Published: ${facts.publishDate}` : null,
    facts.pages ? `Pages: ${facts.pages}` : null,
    facts.subjects.length ? `Subjects: ${facts.subjects.join(", ")}` : null,
  ].filter(Boolean);
  return bits.join("\n");
}
