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
  fitCategory: z.string().trim().max(30).nullable().optional(),
  // Values are in `unit` (except weightKg, always kg).
  heightCm: dim, weightKg: dim, chestCm: dim, waistCm: dim, hipsCm: dim,
  shoulderCm: dim, armLengthCm: dim, inseamCm: dim, neckCm: dim, thighCm: dim,
});

export const recommendSchema = z.object({
  brandSlug: z.string().min(1).max(80),
  categorySlug: z.string().min(1).max(40),
  fitPreference: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).optional(),
  save: z.boolean().optional(),
});

export const compareSchema = z.object({
  categorySlug: z.string().min(1).max(40),
  fitPreference: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).optional(),
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
});

export const chartVersionSchema = z.object({
  brandSlug: z.string().min(1),
  categorySlug: z.string().min(1),
  fitCut: z.enum(["SLIM", "REGULAR", "RELAXED", "OVERSIZED"]).default("REGULAR"),
  measurementType: z.enum(["GARMENT", "BODY"]),
  rows: z.array(chartRowSchema).min(2, "Add at least two sizes.").max(20),
  sourceUrl: z.string().url().optional(),
  sourceNote: z.string().trim().max(500).optional(),
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
