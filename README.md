# ListKit

Photograph a thing on your phone, write the listing on your laptop, paste it into
Facebook Marketplace or Kijiji. Built for one household in Ontario selling
furniture and books locally — cash on pickup, no shipping.

## How it works

The laptop runs the app and is the hub. The phone is just a camera.

```
  phone                        laptop (runs the app)
  ─────                        ────────────────────
  scan QR                      shows QR + inbox
  take photos      ──wifi──▶   photos land on its disk
  say a sentence               Claude drafts the listing
  done                         you review, correct, paste
                               photos are already here to upload
```

**Phone:** open the QR link, take photos, optionally dictate a sentence about
the thing, tap send. That is the entire phone experience — no typing, no
copying, no waiting for anything to process.

**Laptop:** the item appears in the inbox within a few seconds. Open it, and
Claude identifies the thing, judges its condition, names visible flaws,
estimates a price in CAD, and writes listing text sized for each site. You
correct anything wrong, then get one copy button per form field and the photos
sitting in a folder ready to drag into the upload box.

Nothing goes to a cloud service. The photos never leave your house.

This split also fixes the thing that made the phone-only version annoying:
copying now happens on the laptop at `localhost`, which browsers treat as a
secure context, so the clipboard actually works.

## What it deliberately does not do

**It does not post for you, and it never touches your accounts.**

Neither Facebook nor Kijiji offers a public API for personal listings. Meta's
Commerce Platform API is a restricted alpha for approved business partners;
Kijiji has no public posting API, and the community projects that drive its
internal one break whenever Kijiji changes its backend.

That leaves browser automation, which both sites' terms prohibit and which is
enforced by disabling accounts rather than by warning them. A Marketplace ban is
hard to appeal and not worth risking on a family account to save thirty seconds
of pasting. So this app does every part of the job except the final click.

## Setup

On the laptop, once. Requires Node 20 or newer.

```bash
npm install
cp .env.example .env.local     # then paste your key into it
npm run dev
```

Get a key from [console.anthropic.com](https://console.anthropic.com/settings/keys).
It stays on the laptop and is never sent to either browser.

Then open http://localhost:3000, click **Show QR code**, and scan it with the
phone's camera. On the phone, use **Add to Home Screen** so it opens like an app
next time.

The phone has to be on the same wifi, and the laptop has to be running the app
when you photograph something. If you want it always available, `npm run build &&
npm start` on a machine that stays on.

Any laptop in the house can be the hub — the address in the QR code is detected
at runtime, so it works the same on a second computer or after the router hands
out a different address.

### Where things are kept

Everything lives in `.data/` next to the code:

```
.data/settings.json           pickup city and note
.data/items/<id>/meta.json    the note, the draft, where it is posted
.data/items/<id>/01.jpg       the photos, in upload order
```

Plain files, so you can open the folder, back it up, or delete an item by hand.
Set `LISTKIT_DATA_DIR` to put it somewhere else.

## What it costs

Roughly 10–25 cents per listing, most of it the photos — images dominate the
input tokens, so five photos costs about five times one. **This is an estimate
from token maths, not a measurement**; watch your first few listings in the
Anthropic console. Rewriting the text after an edit is much cheaper, since it
sends no photos.

There is a **Draft automatically when photos arrive** switch on the laptop. It
is off by default, because with it on you pay for every batch the phone sends
whether you end up listing it or not.

## Honest limitations

- **Anyone on your wifi can reach it.** There is no login. On a home network
  that is a reasonable trade for a household tool, but it means guests on your
  wifi could open the inbox, and it is not something to expose to the internet
  as-is.
- **Prices are guesses.** The model estimates from the photos and general
  knowledge of the Ontario used market. It has no access to live comparable
  sales. Treat the number as a starting point and spend a minute searching the
  same item on Kijiji before you commit.
- **Category paths drift.** The suggestions in `src/lib/channels.ts` come from
  observing the sites, not from a published taxonomy. When one stops matching
  the real dropdown, fix it there.
- **Dimensions are estimated unless you type them.** The model flags its own
  guesses as approximate and asks you to measure. Measure — buyers ask every
  time.
- **One item per batch.** Photograph one thing, send, photograph the next.
  Batch mode for a box of books would be a natural next step but is not built.
- **The live model call is untested.** The environment this was built in had no
  API key, so the full request has never actually run. Everything around it is
  tested: the schema is verified against the strict structured-output rules the
  API enforces, the whole handoff was exercised against a running server
  (upload, serve, zip, patch, delete, path-traversal attempts), and 28 unit
  tests cover the channel adapters and the zip writer. But the first real photo
  you send will be the first real photo it has ever seen — expect to tune the
  prompts in `src/lib/prompt.ts` once you see what comes back.

## Layout

```
src/app/capture/          the phone: photos in, nothing else
src/app/page.tsx          the laptop: inbox, review, copy-and-paste
src/app/api/handoff/      upload, list, serve photos, zip, delete
src/app/api/analyze/      photos on disk -> drafted listing
src/lib/store.ts          the .data/ file store
src/lib/channels.ts       Facebook and Kijiji field maps, limits, categories
src/lib/prompt.ts         the listing voice and the honesty rules
src/lib/photos.ts         browser-side EXIF stripping and downscaling
src/lib/zip.ts            dependency-free zip so photos are one download
```

Adding a third site means writing one adapter in `channels.ts` — the pipeline
does not change.

## Tests

```bash
npm test        # 28 unit tests, no network, no API key needed
npm run build   # production build + typecheck
```
