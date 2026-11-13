import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import bcrypt from "bcryptjs";

/**
 * Passwords are hashed with Argon2id (OWASP-recommended parameters: 19 MiB, 2 iterations, 1 lane).
 * Accounts created before V5 have bcrypt hashes. They keep working: on the next successful login the password is
 * re-hashed with Argon2id (needsRehash). No existing hash is ever invalidated.
 */
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;
const ARGON_PARAMS = `m=${ARGON.memoryCost},t=${ARGON.timeCost},p=${ARGON.parallelism}`;
// algorithm 2 = Argon2id
export const hashPassword = (password: string) => argonHash(password, { ...ARGON, algorithm: 2 });

const isBcrypt = (h: string) => /^\$2[aby]\$\d{2}\$/.test(h);

export async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  try {
    if (isBcrypt(stored)) {
      const ok = await bcrypt.compare(password, stored);
      return { ok, needsRehash: ok };
    }
    if (stored.startsWith("$argon2")) {
      const ok = await argonVerify(stored, password);
      return { ok, needsRehash: ok && !(stored.startsWith("$argon2id$") && stored.includes(ARGON_PARAMS)) };
    }
  } catch { /* malformed hash: treat as a failed login */ }
  return { ok: false, needsRehash: false };
}

// Computed once; used to spend comparable time when the account does not exist (no user enumeration by timing).
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummy ??= hashPassword("fitsync-timing-equaliser-not-a-real-password");
  await verifyPassword(password, await dummy);
}

export { passwordProblem, PASSWORD_MIN, PASSWORD_MAX } from "./password-policy";
