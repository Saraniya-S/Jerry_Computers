import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Image uploads kept on the server's disk under UPLOAD_DIR (default ./uploads) and served at
 * /uploads/<file>. Swap this module for object storage when hosting without a persistent disk.
 */
const dir = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const types: { ext: string; mime: string; magic: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", magic: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { ext: "gif", mime: "image/gif", magic: (b) => b.subarray(0, 3).toString() === "GIF" },
];

export class UploadError extends Error {}

/** Stores an image after checking its real type from the file's bytes, not its name. Returns its public URL. */
export async function saveImage(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError(`${file.name} is larger than 5 MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = types.find((t) => t.magic(buf));
  if (!type) throw new UploadError(`${file.name} isn't a JPEG, PNG, WebP or GIF image.`);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${type.ext}`;
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}

const safeName = /^[a-z0-9]+-[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

export async function readImage(name: string) {
  if (!safeName.test(name)) return null;
  try {
    const data = await readFile(path.join(dir, name));
    return { data, mime: types.find((t) => name.endsWith(`.${t.ext}`))!.mime };
  } catch {
    return null;
  }
}
