import type { CategoryConfig, EaseRange, FitPreference } from "./types";

/**
 * Default ease allowances (garment minus body, in cm).
 *
 * IMPORTANT: these are reasonable pattern-making starting points, NOT values validated against real
 * fit data. They are configurable per category and are meant to be tuned from user feedback.
 * Do not market recommendations as "scientifically accurate" until validated.
 */
const r = (min: number, max: number): EaseRange => ({ min, max });
const ease = (slim: EaseRange, regular: EaseRange, relaxed: EaseRange, oversized: EaseRange): Record<FitPreference, EaseRange> => ({
  SLIM: slim, REGULAR: regular, RELAXED: relaxed, OVERSIZED: oversized,
});

export const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    slug: "tshirt",
    name: "T-shirt",
    dimensions: {
      chest: { weight: 0.6, tolerance: 8, required: true, ease: ease(r(4, 8), r(8, 14), r(14, 20), r(20, 30)) },
      shoulder: { weight: 0.25, tolerance: 3, ease: ease(r(-1, 1), r(0, 2), r(1, 4), r(3, 9)) },
      waist: { weight: 0.15, tolerance: 10, ease: ease(r(4, 10), r(8, 16), r(14, 24), r(20, 34)) },
    },
  },
  {
    slug: "shirt",
    name: "Shirt",
    dimensions: {
      chest: { weight: 0.45, tolerance: 8, required: true, ease: ease(r(6, 10), r(10, 16), r(16, 22), r(22, 30)) },
      shoulder: { weight: 0.25, tolerance: 3, ease: ease(r(-1, 1), r(0, 2), r(1, 4), r(3, 8)) },
      waist: { weight: 0.15, tolerance: 10, ease: ease(r(6, 12), r(10, 18), r(16, 26), r(22, 34)) },
      neck: { weight: 0.15, tolerance: 2.5, ease: ease(r(1, 2), r(1.5, 3), r(2.5, 4), r(3, 5)) },
    },
  },
  {
    slug: "hoodie",
    name: "Hoodie / sweatshirt",
    dimensions: {
      chest: { weight: 0.55, tolerance: 10, required: true, ease: ease(r(8, 14), r(14, 22), r(22, 30), r(30, 42)) },
      shoulder: { weight: 0.3, tolerance: 4, ease: ease(r(0, 2), r(1, 4), r(3, 7), r(5, 12)) },
      waist: { weight: 0.15, tolerance: 12, ease: ease(r(6, 14), r(12, 22), r(20, 32), r(28, 44)) },
    },
  },
  {
    slug: "jeans",
    name: "Jeans / trousers",
    dimensions: {
      waist: { weight: 0.5, tolerance: 5, required: true, ease: ease(r(0, 2), r(1, 4), r(3, 7), r(5, 11)) },
      hips: { weight: 0.3, tolerance: 8, ease: ease(r(2, 6), r(4, 10), r(8, 16), r(12, 22)) },
      thigh: { weight: 0.1, tolerance: 6, ease: ease(r(2, 6), r(5, 10), r(8, 14), r(12, 20)) },
      inseam: { weight: 0.1, tolerance: 6, ease: ease(r(-2, 2), r(-2, 2), r(-2, 3), r(-2, 4)) },
    },
  },
  { slug: "polo", name: "Polo T-shirt", dimensions: {
      chest: { weight: 0.55, tolerance: 8, required: true, ease: ease(r(5, 9), r(9, 15), r(15, 21), r(21, 30)) },
      shoulder: { weight: 0.3, tolerance: 3, ease: ease(r(-1, 1), r(0, 2), r(1, 4), r(3, 8)) },
      waist: { weight: 0.15, tolerance: 10, ease: ease(r(5, 11), r(9, 17), r(15, 25), r(21, 34)) },
  } },
  { slug: "sweatshirt", name: "Sweatshirt", dimensions: {
      chest: { weight: 0.55, tolerance: 10, required: true, ease: ease(r(8, 14), r(14, 22), r(22, 30), r(30, 42)) },
      shoulder: { weight: 0.3, tolerance: 4, ease: ease(r(0, 2), r(1, 4), r(3, 7), r(5, 12)) },
      waist: { weight: 0.15, tolerance: 12, ease: ease(r(6, 14), r(12, 22), r(20, 32), r(28, 44)) },
  } },
  { slug: "jacket", name: "Jacket", dimensions: {
      chest: { weight: 0.55, tolerance: 10, required: true, ease: ease(r(8, 14), r(14, 22), r(22, 30), r(30, 40)) },
      shoulder: { weight: 0.3, tolerance: 3.5, ease: ease(r(0, 2), r(1, 4), r(3, 6), r(5, 10)) },
      waist: { weight: 0.15, tolerance: 12, ease: ease(r(6, 14), r(12, 22), r(20, 32), r(28, 44)) },
  } },
  { slug: "top", name: "Women's top", dimensions: {
      chest: { weight: 0.5, tolerance: 8, required: true, ease: ease(r(2, 6), r(6, 12), r(12, 18), r(18, 28)) },
      waist: { weight: 0.3, tolerance: 10, ease: ease(r(2, 8), r(6, 14), r(12, 22), r(18, 32)) },
      shoulder: { weight: 0.2, tolerance: 3, ease: ease(r(-1, 1), r(0, 2), r(1, 4), r(3, 8)) },
  } },
  { slug: "chinos", name: "Chinos", dimensions: {
      waist: { weight: 0.5, tolerance: 5, required: true, ease: ease(r(0, 2), r(1, 4), r(3, 7), r(5, 11)) },
      hips: { weight: 0.3, tolerance: 8, ease: ease(r(2, 6), r(4, 10), r(8, 16), r(12, 22)) },
      thigh: { weight: 0.1, tolerance: 6, ease: ease(r(2, 6), r(5, 10), r(8, 14), r(12, 20)) },
      inseam: { weight: 0.1, tolerance: 6, ease: ease(r(-2, 2), r(-2, 2), r(-2, 3), r(-2, 4)) },
  } },
  { slug: "joggers", name: "Joggers", dimensions: {
      waist: { weight: 0.5, tolerance: 6, required: true, ease: ease(r(-2, 2), r(0, 5), r(3, 9), r(6, 14)) },
      hips: { weight: 0.3, tolerance: 9, ease: ease(r(2, 8), r(5, 12), r(10, 18), r(14, 24)) },
      thigh: { weight: 0.1, tolerance: 7, ease: ease(r(2, 8), r(5, 12), r(10, 16), r(14, 22)) },
      inseam: { weight: 0.1, tolerance: 6, ease: ease(r(-3, 2), r(-3, 2), r(-3, 3), r(-3, 4)) },
  } },
  { slug: "shorts", name: "Shorts", dimensions: {
      waist: { weight: 0.55, tolerance: 5, required: true, ease: ease(r(0, 2), r(1, 5), r(3, 8), r(5, 12)) },
      hips: { weight: 0.3, tolerance: 8, ease: ease(r(2, 6), r(4, 10), r(8, 16), r(12, 22)) },
      thigh: { weight: 0.15, tolerance: 6, ease: ease(r(2, 6), r(5, 11), r(9, 15), r(13, 22)) },
  } },
  { slug: "skirt", name: "Skirt", dimensions: {
      waist: { weight: 0.6, tolerance: 5, required: true, ease: ease(r(0, 2), r(1, 4), r(3, 7), r(5, 11)) },
      hips: { weight: 0.4, tolerance: 8, ease: ease(r(2, 6), r(4, 10), r(8, 16), r(12, 22)) },
  } },
  { slug: "dress", name: "Dress", dimensions: {
      chest: { weight: 0.4, tolerance: 8, required: true, ease: ease(r(0, 4), r(4, 10), r(10, 18), r(16, 28)) },
      waist: { weight: 0.3, tolerance: 8, ease: ease(r(0, 4), r(4, 12), r(10, 20), r(16, 30)) },
      hips: { weight: 0.3, tolerance: 8, ease: ease(r(0, 4), r(4, 10), r(8, 18), r(14, 26)) },
  } },
];

/**
 * For BODY charts (brand publishes the body a size is made for) the brand already included ease,
 * so the ideal difference (chart - body) is about zero, shifted a little by preference.
 */
export const BODY_CHART_OFFSET: Record<FitPreference, EaseRange> = {
  SLIM: r(-3, 0),
  REGULAR: r(-1, 2),
  RELAXED: r(1, 5),
  OVERSIZED: r(4, 10),
};

export const MIN_ACCEPTABLE_SCORE = 0.5;
export const UNVERIFIED_SCORE_CAP = 0.55;

/** Categories we have NO measurement mapping for yet. They are deliberately not supported rather than guessed. */
export const UNSUPPORTED_CATEGORIES = ["ethnic wear", "co-ord sets"] as const;

export const getCategoryConfig = (slug: string) => CATEGORY_CONFIGS.find((c) => c.slug === slug);
