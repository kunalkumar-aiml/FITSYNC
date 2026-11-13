import { readFileSync } from "node:fs";
import { join } from "node:path";

/** tsx does not read .env by itself: load it for CLI scripts without overriding variables that are already set. */
export function loadDotEnv() {
  try {
    for (const line of readFileSync(join(__dirname, "..", ".env"), "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* no .env file */ }
}
