import { COMMON_PASSWORDS } from "./common-passwords";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/**
 * Length-based policy (NIST SP 800-63B style): 10–128 characters, no arbitrary composition rules,
 * reject very common passwords and passwords built from the user's own email or name.
 * Returns a message for the user, or null when the password is acceptable.
 */
export function passwordProblem(password: string, ctx: { email?: string; name?: string | null } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters. A short phrase of a few words works well.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || COMMON_PASSWORDS.has(lower.replace(/[!@#$.]+$/, ""))) return "This password is too common. Choose something less predictable.";
  if (/^(.)\1+$/.test(password)) return "Don’t repeat a single character.";
  if (isSequence(lower)) return "Avoid simple sequences like 12345678 or abcdefgh.";
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Don’t include your email address in your password.";
  const name = ctx.name?.trim().toLowerCase();
  if (name && name.length >= 4 && lower.replace(/\s/g, "").includes(name.replace(/\s/g, ""))) return "Don’t use your name as your password.";
  return null;
}

function isSequence(s: string) {
  if (s.length < 6) return false;
  const codes = [...s].map((c) => c.charCodeAt(0));
  const step = codes[1] - codes[0];
  return Math.abs(step) === 1 && codes.every((c, i) => i === 0 || c - codes[i - 1] === step);
}
