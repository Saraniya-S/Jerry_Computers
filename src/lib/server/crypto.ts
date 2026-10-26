import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from "node:crypto";
import { env } from "./env";

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } satisfies ScryptOptions;
const KEY_LEN = 64;

function scryptAsync(password: BinaryLike, salt: BinaryLike) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_LEN, SCRYPT, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Format: scrypt$N$r$p$salt$hash (base64url). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, , , , salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const key = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64url"));
  const expected = Buffer.from(hash, "base64url");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

/** A hash to compare against when the account doesn't exist, so timing doesn't reveal it. */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash() {
  return (dummyHash ??= hashPassword(randomBytes(16).toString("hex")));
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtp(challengeId: string, code: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(`${challengeId}:${code}`).digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
