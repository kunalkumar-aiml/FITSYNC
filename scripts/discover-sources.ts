/**
 * npm run research:discover -- <brand-slug> <category> <MEN|WOMEN|UNISEX> ["product words"]
 * Prints candidate URLs from the configured search API (see docs/RESEARCH.md). Review them, then add the ones you want
 * to prisma/data/research/targets.json and run `npm run research`. Nothing is fetched by this script.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { discoverSources } from "../src/lib/research/discovery";
import { loadDotEnv } from "./load-env";
loadDotEnv();

async function main() {
  const [brandSlug, category, gender, productQuery] = process.argv.slice(2);
  if (!brandSlug || !category || !gender) throw new Error("Usage: npm run research:discover -- <brand-slug> <category> <MEN|WOMEN|UNISEX> [product words]");
  const brands: { slug: string; name: string }[] = JSON.parse(readFileSync(join(__dirname, "..", "prisma", "data", "brands.json"), "utf8"));
  const brand = brands.find((b) => b.slug === brandSlug);
  if (!brand) throw new Error(`Unknown brand slug ${brandSlug}`);
  const r = await discoverSources({ brandName: brand.name, brandSlug, category, gender, productQuery });
  console.log(JSON.stringify(r, null, 2));
  if (!r.configured) process.exitCode = 2;
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
