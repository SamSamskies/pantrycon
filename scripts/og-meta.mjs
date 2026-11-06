// Helpers shared by scripts/og.mjs (writes the share image) and the tests (check it).
// The share image records the level and review time it was drawn from inside the PNG
// itself (tEXt chunks), so there is no second copy of either value in the repo.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_LEVEL_KEY = "pantrycon-level";
export const OG_REVIEWED_KEY = "pantrycon-reviewed-at";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function* chunks(png) {
  if (!Buffer.isBuffer(png) || !png.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("Not a PNG file.");
  }
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    yield { type, data: png.subarray(offset + 8, offset + 8 + length), start: offset, end: offset + 12 + length };
    offset += 12 + length;
  }
}

export function pngSize(png) {
  for (const c of chunks(png)) {
    if (c.type === "IHDR") return { width: c.data.readUInt32BE(0), height: c.data.readUInt32BE(4) };
  }
  throw new Error("PNG has no IHDR chunk.");
}

export function readPngText(png) {
  const out = {};
  for (const c of chunks(png)) {
    if (c.type !== "tEXt") continue;
    const split = c.data.indexOf(0);
    if (split > 0) out[c.data.toString("latin1", 0, split)] = c.data.toString("latin1", split + 1);
  }
  return out;
}

export function withPngText(png, entries) {
  const parts = [SIGNATURE];
  let inserted = false;
  for (const c of chunks(png)) {
    if (c.type === "tEXt") {
      const key = c.data.toString("latin1", 0, Math.max(c.data.indexOf(0), 0));
      if (Object.hasOwn(entries, key)) continue;
    }
    if (c.type === "IDAT" && !inserted) {
      Object.entries(entries).forEach(([key, value]) => {
        parts.push(chunk("tEXt", Buffer.from(key + "\0" + value, "latin1")));
      });
      inserted = true;
    }
    parts.push(png.subarray(c.start, c.end));
  }
  if (!inserted) throw new Error("PNG has no IDAT chunk.");
  return Buffer.concat(parts);
}

// Cache-busting stamp for the og:image URL, derived only from the review time.
export function ogVersion(reviewedAt) {
  return String(reviewedAt).replace(/[-:]/g, "");
}

export const OG_IMAGE_URL = "https://pantrycon.vercel.app/og-image.png";

export function ogImageUrl(reviewedAt) {
  return OG_IMAGE_URL + "?v=" + ogVersion(reviewedAt);
}
