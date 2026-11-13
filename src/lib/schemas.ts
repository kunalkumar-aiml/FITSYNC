import { z } from "zod";

const dim = z.number().finite().positive().max(300).nullable().optional();

import { passwordProblem, PASSWORD_MAX } from "./security/password-policy";

/** Email normalisation: Unicode NFKC, trimmed, lower-cased. One address = one account. */
export const emailField = z.string().max(254).transform((v) => v.normalize("NFKC").trim().toLowerCase())
  .pipe(z.string().email("Enter a valid email address."));

const newPassword = (path: string, ctx: z.RefinementCtx, password: string, about: { email?: string; name?: string | null }) => {
  const p = passwordProblem(password, about);
  if (p) ctx.addIssue({ code: "custom", path: [path], message: p });
};

export const registerSchema = z.object({
  email: emailField,
  password: z.string().max(PASSWORD_MAX),
  name: z.string().trim().min(1).max(80).optional(),
}).superRefine((v, ctx) => newPassword("password", ctx, v.password, v));

// Login accepts any stored password length so accounts created under older rules keep working.
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const forgotSchema = z.object({ email: emailField });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: z.string().max(PASSWORD_MAX) })
  .superRefine((v, ctx) => newPassword("password", ctx, v.password, {}));
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(PASSWORD_MAX), newPassword: z.string().max(PASSWORD_MAX) });
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(PASSWORD_MAX) });
export const accountSchema = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  preferredUnit: z.enum(["CM", "IN"]).optional(),
  fitPreference: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).optional(),
  fitCategory: z.enum(["MEN", "WOMEN", "UNISEX"]).nullable().optional(),
});
export const adminUserUpdateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  disabled: z.boolean().optional(),
  confirm: z.literal(true, { errorMap: () => ({ message: "Confirm this change." }) }),
  reason: z.string().trim().min(3, "Say why (saved to the audit log).").max(300),
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

/** Only https links are stored and rendered (no javascript:, data: or http: links in the UI). */
export const httpsUrl = z.string().trim().max(2000).url().refine((v) => { try { return new URL(v).protocol === "https:"; } catch { return false; } }, "Use an https:// link.");

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
  // The cut is required and may be UNKNOWN: a chart is never assumed to be a REGULAR cut.
  fitCut: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED", "UNKNOWN"], { required_error: "Say which cut the source states, or Unknown." }),
  // UNKNOWN keeps every dimension out of recommendations until someone states its meaning.
  measurementType: z.enum(["GARMENT", "BODY", "UNKNOWN"]),
  sourceType: z.enum(["OFFICIAL_SITE", "OFFICIAL_PDF", "OFFICIAL_PRODUCT_PAGE", "MARKETPLACE_LISTING", "STORE_MEASURED", "MANUAL_ENTRY"]).default("MANUAL_ENTRY"),
  productId: z.string().min(1).optional(),
  ambiguousDimensions: z.array(z.enum(["chest", "waist", "hips", "shoulder", "armLength", "inseam", "neck", "thigh"])).default([]),
  // The unit must be stated explicitly; nothing defaults to centimetres.
  originalUnit: z.enum(["CM", "IN"], { required_error: "Choose the unit the source uses." }),
  rows: z.array(chartRowSchema).min(2, "Add at least two sizes.").max(30),
  sourceUrl: httpsUrl.optional(),
  sourceNote: z.string().trim().max(500).optional(),
});

// CSV import: the server parses and validates (never trust the browser's parse). Values are converted to cm.
export const chartImportSchema = chartVersionSchema.omit({ rows: true }).extend({
  csv: z.string().min(10).max(50_000),
  dryRun: z.boolean().default(false),
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
  sourceUrl: httpsUrl.optional(),
}).superRefine((v, ctx) => {
  if (v.action !== "APPROVE" && (!v.note || v.note.length < 3)) ctx.addIssue({ code: "custom", path: ["note"], message: "Say why (saved to the audit log)." });
});
export const editVersionSchema = z.object({
  rows: z.array(chartRowSchema).min(2).max(30).optional(),
  measurementType: z.enum(["GARMENT", "BODY", "UNKNOWN"]).optional(),
  // resolve an ambiguous dimension by stating what it is. This is a human decision and is recorded.
  resolveSemantics: z.record(z.enum(["chest", "waist", "hips", "shoulder", "armLength", "inseam", "neck", "thigh"]),
    z.enum(["BODY_CIRCUMFERENCE", "GARMENT_CIRCUMFERENCE", "BODY_LINEAR", "GARMENT_LINEAR", "GARMENT_WIDTH_FLAT"])).optional(),
  /** Explicit, recorded conversion of flat garment widths (chest/waist/hips/thigh) to circumference (x2). Never automatic. */
  convertFlatToCircumference: z.boolean().optional(),
  note: z.string().trim().min(3, "Say what you changed and why.").max(500),
});
export const brandEditSchema = z.object({ name: z.string().trim().min(2).max(60).optional(), region: z.enum(["INTERNATIONAL", "INDIAN"]).optional(), active: z.boolean().optional() });
export const productSchema = z.object({
  brandSlug: z.string().min(1), name: z.string().trim().min(3).max(200), categorySlug: z.string().min(1),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]), fitCut: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED", "UNKNOWN"]).default("UNKNOWN"),
  fitCutStated: z.boolean().default(false),
  marketplaceSlug: z.string().trim().max(40).optional(), listingUrl: httpsUrl.optional(),
});
export const marketplaceSchema = z.object({ name: z.string().trim().min(2).max(60), domain: z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a domain like www.example.com") });

export const discoverySchema = z.object({
  brand: z.string().min(1).max(80), category: z.string().min(1).max(40), gender: z.enum(["MEN", "WOMEN", "UNISEX"]),
  productQuery: z.string().trim().max(120).optional(),
});
export const userSearchSchema = z.object({ q: z.string().trim().max(120).optional(), page: z.coerce.number().int().min(1).max(1000).default(1) });
export const coverageNoteSchema = z.object({
  brandSlug: z.string().min(1).max(80), productId: z.string().min(1).max(40).optional(),
  categorySlug: z.string().min(1).max(40).optional(), gender: z.enum(["MEN", "WOMEN", "UNISEX"]).optional(),
  note: z.string().trim().min(10, "Describe what was checked and why no usable data exists.").max(500), sourceUrl: httpsUrl.optional(),
});
