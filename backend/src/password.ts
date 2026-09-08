import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify resolves to scrypt's no-options overload, so name the one we want.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// bcrypt and argon2 are the usual picks and either is a fine answer in an
// interview. scrypt is used here because it ships inside Node: no native build
// step, so this deploys from any laptop on any wifi.
const COST = 16_384; // scrypt N. Memory used is 128 * N * r ≈ 16 MB.
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Returns "scrypt$<N>$<salt-hex>$<key-hex>" — the parameters travel with the
 *  hash so the cost can be raised later without invalidating old passwords. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(plain, salt, KEY_LENGTH, { N: COST });
  return `scrypt$${COST}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  plain: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) {
    return false;
  }

  const [scheme, costRaw, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !costRaw || !saltHex || !keyHex) {
    return false;
  }

  const cost = Number(costRaw);
  const expected = Buffer.from(keyHex, "hex");
  if (!Number.isInteger(cost) || expected.length === 0) {
    return false;
  }

  const actual = await scryptAsync(
    plain,
    Buffer.from(saltHex, "hex"),
    expected.length,
    { N: cost },
  );

  // Constant time: a plain === would leak how much of the hash matched.
  return timingSafeEqual(actual, expected);
}
