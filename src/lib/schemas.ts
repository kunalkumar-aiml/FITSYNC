import { z } from "zod";

const dim = z.number().finite().positive().max(300).nullable().optional();

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
  name: z.string().trim().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const measurementsSchema = z.object({
  unit: z.enum(["CM", "IN"]).default("CM"),
  fitPreference: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).optional(),
  fitCategory: z.enum(["MEN", "WOMEN", "UNISEX"]).nullable().optional(),
  // Values are in `unit` (except weightKg, always kg).
  heightCm: dim, weightKg: dim, chestCm: dim, waistCm: dim, hipsCm: dim,
  shoulderCm: dim, armLengthCm: dim, inseamCm: dim, neckCm: dim, thighCm: dim,
});

export const recommendSchema = z.object({
  brandSlug: z.string().min(1).max(80),
  categorySlug: z.string().min(1).max(40),
  fitPreference: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).optional(),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).optional(),
  region: z.string().trim().max(20).optional(),
  productId: z.string().trim().max(40).optional(),
  save: z.boolean().optional(),
});

export const compareSchema = z.object({
  categorySlug: z.string().min(1).max(40),
  fitPreference: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).optional(),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).optional(),
  region: z.string().trim().max(20).optional(),
});

export const feedbackSchema = z.object({
  recommendationId: z.string().min(1),
  purchasedSize: z.string().trim().min(1).max(20),
  outcome: z.enum(["TOO_TIGHT", "PERFECT", "TOO_LOOSE"]),
  review: z.string().trim().max(1000).optional(),
});

const rowNum = z.number().finite().positive().max(300).optional();
export const chartRowSchema = z.object({
  label: z.string().trim().min(1).max(12),
  chest: rowNum, waist: rowNum, hips: rowNum, shoulder: rowNum,
  armLength: rowNum, inseam: rowNum, neck: rowNum, thigh: rowNum,
  chestMax: rowNum, waistMax: rowNum, hipsMax: rowNum, shoulderMax: rowNum,
  armLengthMax: rowNum, inseamMax: rowNum, neckMax: rowNum, thighMax: rowNum,
  garmentLength: rowNum, sleeveLength: rowNum, rise: rowNum, legOpening: rowNum,
});

export const chartVersionSchema = z.object({
  brandSlug: z.string().min(1),
  categorySlug: z.string().min(1),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]).default("UNISEX"),
  region: z.string().trim().min(1).max(20).default("GLOBAL"),
  productLine: z.string().trim().max(80).default(""),
  fitCut: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).default("REGULAR"),
  measurementType: z.enum(["GARMENT", "BODY"]),
  sourceType: z.enum(["OFFICIAL_SITE", "OFFICIAL_PDF", "OFFICIAL_PRODUCT_PAGE", "MARKETPLACE_LISTING", "STORE_MEASURED", "MANUAL_ENTRY"]).default("MANUAL_ENTRY"),
  productId: z.string().min(1).optional(),
  ambiguousDimensions: z.array(z.enum(["chest", "waist", "hips", "shoulder", "armLength", "inseam", "neck", "thigh"])).default([]),
  originalUnit: z.enum(["CM", "IN"]).default("CM"),
  rows: z.array(chartRowSchema).min(2, "Add at least two sizes.").max(30),
  sourceUrl: z.string().url().optional(),
  sourceNote: z.string().trim().max(500).optional(),
});

// CSV import: the server parses and validates (never trust the browser's parse). Values are converted to cm.
export const chartImportSchema = chartVersionSchema.omit({ rows: true }).extend({
  csv: z.string().min(10).max(50_000),
  dryRun: z.boolean().default(false),
});

export const verifySchema = z.object({
  status: z.enum(["VERIFIED", "UNVERIFIED", "DEPRECATED"]),
  sourceUrl: z.string().url().optional(),
  sourceNote: z.string().trim().max(500).optional(),
});

export const brandSchema = z.object({
  name: z.string().trim().min(2).max(60),
  region: z.enum(["INTERNATIONAL", "INDIAN"]),
});

// ---- V3 admin
import { validateResearchUrl, UnsafeUrlError } from "./research/url-safety";
const safeUrl = z.string().trim().max(2000).superRefine((v, ctx) => {
  try { validateResearchUrl(v); } catch (e) { ctx.addIssue({ code: "custom", message: e instanceof UnsafeUrlError ? e.message : "Invalid URL." }); }
});
export const researchTargetSchema = z.object({
  brand: z.string().min(1).max(80), category: z.string().min(1).max(40), gender: z.enum(["MEN", "WOMEN", "UNISEX"]),
  region: z.string().trim().min(1).max(20).default("GLOBAL"), url: safeUrl,
  productName: z.string().trim().max(200).optional(), marketplace: z.string().trim().max(40).optional(),
  fitCut: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).optional(),
});
export const researchJobSchema = z.object({ targets: z.array(researchTargetSchema).min(1).max(5, "At most 5 URLs per job.") });

export const decisionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "FLAG", "DEPRECATE"]),
  note: z.string().trim().max(500).optional(),
  sourceUrl: z.string().url().optional(),
});
export const editVersionSchema = z.object({
  rows: z.array(chartRowSchema).min(2).max(30).optional(),
  measurementType: z.enum(["GARMENT", "BODY"]).optional(),
  // resolve an ambiguous dimension by stating what it is. This is a human decision and is recorded.
  resolveSemantics: z.record(z.enum(["chest", "waist", "hips", "shoulder", "armLength", "inseam", "neck", "thigh"]), z.enum(["BODY_CIRCUMFERENCE", "GARMENT_CIRCUMFERENCE"])).optional(),
  note: z.string().trim().min(3, "Say what you changed and why.").max(500),
});
export const brandEditSchema = z.object({ name: z.string().trim().min(2).max(60).optional(), region: z.enum(["INTERNATIONAL", "INDIAN"]).optional(), active: z.boolean().optional() });
export const productSchema = z.object({
  brandSlug: z.string().min(1), name: z.string().trim().min(3).max(200), categorySlug: z.string().min(1),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]), fitCut: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).default("REGULAR"),
  fitCutStated: z.boolean().default(false),
  marketplaceSlug: z.string().trim().max(40).optional(), listingUrl: z.string().url().optional(),
});
export const marketplaceSchema = z.object({ name: z.string().trim().min(2).max(60), domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like www.example.com") });
