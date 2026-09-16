import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildZip, crc32 } from "./zip.ts";

test("crc32 matches the known check value", () => {
  // The standard CRC-32 of "123456789".
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("an empty archive is still a valid archive", () => {
  const zip = buildZip([]);
  assert.equal(zip.length, 22);
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x06054b50);
});

test("a real unzip can read the archive back byte for byte", (t) => {
  try {
    execFileSync("unzip", ["-v"], { stdio: "ignore" });
  } catch {
    t.skip("unzip is not installed here");
    return;
  }

  const jpegish = new Uint8Array(5000);
  for (let i = 0; i < jpegish.length; i += 1) jpegish[i] = (i * 31 + 7) % 256;
  const text = new TextEncoder().encode("dimensions: 80 x 28 x 202\n");

  const zip = buildZip([
    { name: "01-billy-bookcase.jpg", data: jpegish },
    { name: "02-billy-bookcase.jpg", data: jpegish.slice(0, 1234) },
    { name: "notes.txt", data: text },
  ]);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "listkit-zip-"));
  const file = path.join(dir, "photos.zip");
  fs.writeFileSync(file, zip);

  // -t makes unzip verify every entry's CRC against the stored value.
  const verified = execFileSync("unzip", ["-t", file], { encoding: "utf8" });
  assert.match(verified, /No errors detected/);

  execFileSync("unzip", ["-q", file, "-d", dir]);
  assert.deepEqual(
    new Uint8Array(fs.readFileSync(path.join(dir, "01-billy-bookcase.jpg"))),
    jpegish,
  );
  assert.equal(fs.readFileSync(path.join(dir, "notes.txt"), "utf8"), "dimensions: 80 x 28 x 202\n");

  fs.rmSync(dir, { recursive: true, force: true });
});
