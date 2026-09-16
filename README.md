# ListKit

Photograph a thing, get a finished Facebook Marketplace and Kijiji listing you
can paste in. Built for one household in Ontario selling furniture and books
locally — cash on pickup, no shipping.

## What it does

1. **Take photos on your phone.** They are downscaled and re-encoded in the
   browser, which strips all EXIF metadata — including the GPS coordinates your
   phone writes into every photo, which is your home address.
2. **Claude reads them** and returns what the item is, its condition, visible
   flaws, an estimated price in CAD, and listing text written separately for
   each site's length limits and audience.
3. **You review and correct.** Anything the photos could not answer comes back
   as a short checklist instead of an invented fact.
4. **You paste.** One copy button per form field, in the order each site asks
   for them, plus a share sheet that hands the cleaned photos to the Facebook
   app or your photo library.
5. **It remembers where things are live**, so the Kijiji ad comes down when the
   thing sells on Facebook.

## What it deliberately does not do

**It does not post for you, and it never touches your accounts.**

Neither Facebook nor Kijiji offers a public API for personal listings. Meta's
Commerce Platform API is a restricted alpha for approved business partners;
Kijiji has no public posting API and the community projects that drive its
internal mobile API break whenever Kijiji changes its backend.

That leaves browser automation, which both sites' terms prohibit and which is
enforced by disabling accounts rather than by warning them. A Marketplace ban is
hard to appeal and not worth risking on a family account to save thirty seconds
of pasting. So this app does every part of the job except the final click.

If you later want one channel that *is* fully automatable, eBay's Sell API is
open to individual sellers — but eBay is built around shipping, so it is a poor
fit for local pickup.

## Setup

Requires Node 20 or newer.

```bash
npm install
cp .env.example .env.local     # then paste your key into it
npm run dev
```

Get a key from [console.anthropic.com](https://console.anthropic.com/settings/keys).
It stays on the server and is never sent to the browser — that is the only
reason this app has a backend at all.

### Using it from your phone

`npm run dev` prints a Network address (`http://192.168.x.x:3000`). Open that on
your phone while it is on the same wifi, then use **Add to Home Screen** so it
opens full-screen like an app.

One catch: `navigator.clipboard` only works in a secure context, so over plain
http the copy buttons fall back to a manual-select prompt. Deploying (below)
gives you https and makes them work properly.

### Deploying

It is a stock Next.js app, so Vercel's free tier works: import the repo, set
`ANTHROPIC_API_KEY` as an environment variable, deploy. Note that this puts a
URL on the public internet with your API key behind it — if that bothers you,
add Vercel's password protection, or just run it locally when you need it.

## What it costs

Roughly 10–25 cents per listing, most of it the photos — images dominate the
input tokens, so five photos costs about five times one. **This is an estimate
from token maths, not a measurement**; watch your first few listings in the
Anthropic console and decide whether it is worth it to you. Rewriting the text
after an edit is much cheaper, since it sends no photos.

## Honest limitations

- **Prices are guesses.** The model estimates from the photos and general
  knowledge of the Ontario used market. It has no access to live comparable
  sales. Treat the number as a starting point and spend a minute searching the
  same item on Kijiji before you commit.
- **Category paths drift.** The category suggestions in `src/lib/channels.ts`
  come from observing the sites, not from a published taxonomy. When one stops
  matching the real dropdown, fix it there.
- **Dimensions are estimated unless you type them.** The model flags its own
  guesses as approximate and asks you to measure. Measure — buyers ask every
  time.
- **The ledger is per-device.** It lives in `localStorage`, so your phone and
  your laptop keep separate lists, and clearing site data erases it. That is a
  deliberate trade against running a database for a household app.
- **One item at a time.** Batch mode for a box of books would be a natural next
  step but is not built.
- **The live model call is untested.** The environment this was built in had no
  API key, so the full request has never actually run. Everything around it is
  tested: the schema is verified to satisfy the strict structured-output rules
  the API enforces, validation and error paths were exercised against a running
  server, and 25 unit tests cover the channel adapters. But the first real photo
  you send will be the first real photo it has ever seen — expect to tune the
  prompts in `src/lib/prompt.ts` once you see what comes back.

## Layout

```
src/lib/types.ts      one canonical Item; every channel is a projection of it
src/lib/channels.ts   Facebook and Kijiji field maps, limits, categories
src/lib/prompt.ts     the listing voice and the honesty rules
src/lib/photos.ts     browser-side EXIF stripping and downscaling
src/lib/books.ts      Open Library ISBN lookup (best effort, never blocking)
src/lib/storage.ts    the per-device ledger
src/app/api/          analyze (photos -> draft) and rewrite (facts -> copy)
```

Adding a third site means writing one adapter in `channels.ts` — the pipeline
does not need to change.

## Tests

```bash
npm test        # 25 unit tests, no network, no API key needed
npm run build   # production build + typecheck
```
