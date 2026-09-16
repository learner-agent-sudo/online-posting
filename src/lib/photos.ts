/**
 * Photo preparation, all of it in the browser.
 *
 * Re-encoding through a canvas strips every piece of metadata the camera
 * attached — including the GPS coordinates of your house, which phone photos
 * carry by default and which people routinely publish without realising. The
 * bytes that reach the API, and the bytes you upload to Marketplace, are pixels
 * and nothing else.
 *
 * Downscaling is the other half: a modern phone photo is 4-12 MB, which is
 * wasteful to send and slower to analyse. 1600px on the long edge is plenty for
 * both the model and the listing.
 */

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.85;
const THUMB_EDGE = 160;

export interface PreparedPhoto {
  id: string;
  /** Base64 without the `data:` prefix, ready for the API. */
  data: string;
  media_type: "image/jpeg";
  /** Object URL for on-screen preview. Revoke when discarding. */
  previewUrl: string;
  bytes: number;
  originalName: string;
  originalBytes: number;
}

function scaleToFit(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

/**
 * `imageOrientation: "from-image"` applies the EXIF rotation tag to the pixels
 * before we drop the tag. Without it, portrait phone photos would come out
 * sideways once the metadata that described the rotation is gone.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older Safari without the option: fall back to an <img>, which browsers
    // orient correctly on their own when drawing.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function drawToCanvas(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
): HTMLCanvasElement {
  const sourceWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sourceHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
  const { width, height } = scaleToFit(sourceWidth, sourceHeight, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser would not give us a canvas to work with.");

  // White matte: JPEG has no alpha channel, and transparent PNG regions would
  // otherwise come out black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the image."))),
      "image/jpeg",
      quality,
    );
  });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Chunked so a multi-megabyte image does not blow the argument limit on
  // String.fromCharCode.
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const source = await loadBitmap(file);
  const canvas = drawToCanvas(source, MAX_EDGE);
  if ("close" in source) source.close();

  const blob = await canvasToBlob(canvas, JPEG_QUALITY);
  const data = await blobToBase64(blob);

  return {
    id: crypto.randomUUID(),
    data,
    media_type: "image/jpeg",
    previewUrl: URL.createObjectURL(blob),
    bytes: blob.size,
    originalName: file.name || "photo.jpg",
    originalBytes: file.size,
  };
}

/**
 * Small JPEG data URL for the saved-listings list. Built from the already
 * prepared photo rather than the original File, because a data URL survives a
 * page reload in localStorage and an object URL does not.
 */
export async function makeThumbnail(photo: PreparedPhoto): Promise<string | null> {
  try {
    const img = new Image();
    img.src = `data:${photo.media_type};base64,${photo.data}`;
    await img.decode();
    const canvas = drawToCanvas(img, THUMB_EDGE);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Filenames that sort into the order the photos should be uploaded in. */
export function exportFilename(index: number, itemName: string): string {
  const slug = itemName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "listing";
  return `${String(index + 1).padStart(2, "0")}-${slug}.jpg`;
}
