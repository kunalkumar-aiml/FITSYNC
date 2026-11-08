import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { measurementsSchema } from "@/lib/schemas";
import { LIMITS, round1, toCm, validateBody, type BodyMeasurements } from "@/lib/engine";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const [profile, measurement] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: user.id } }),
    db.bodyMeasurement.findUnique({ where: { userId: user.id } }),
  ]);
  return ok({ profile, measurement });
});

// Create or update (idempotent). Values arrive in the user's unit and are stored in cm / kg.
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const input = await parseBody(req, measurementsSchema);
  const cm = (v: number | null | undefined) => (v == null ? null : round1(toCm(v, input.unit)));
  const data = {
    heightCm: cm(input.heightCm), weightKg: input.weightKg ?? null, chestCm: cm(input.chestCm),
    waistCm: cm(input.waistCm), hipsCm: cm(input.hipsCm), shoulderCm: cm(input.shoulderCm),
    armLengthCm: cm(input.armLengthCm), inseamCm: cm(input.inseamCm), neckCm: cm(input.neckCm),
    thighCm: cm(input.thighCm),
  };
  const body: BodyMeasurements = {
    height: data.heightCm ?? undefined, weightKg: data.weightKg ?? undefined, chest: data.chestCm ?? undefined,
    waist: data.waistCm ?? undefined, hips: data.hipsCm ?? undefined, shoulder: data.shoulderCm ?? undefined,
    armLength: data.armLengthCm ?? undefined, inseam: data.inseamCm ?? undefined,
    neck: data.neckCm ?? undefined, thigh: data.thighCm ?? undefined,
  };
  const errors = validateBody(body);
  if (errors.length) throw new ApiError(400, errors[0], { errors, limits: LIMITS });

  const [measurement, profile] = await Promise.all([
    db.bodyMeasurement.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data }),
    db.userProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, preferredUnit: input.unit, fitPreference: input.fitPreference ?? "REGULAR", fitCategory: input.fitCategory ?? null },
      update: { preferredUnit: input.unit, ...(input.fitPreference ? { fitPreference: input.fitPreference } : {}), ...(input.fitCategory !== undefined ? { fitCategory: input.fitCategory } : {}) },
    }),
  ]);
  return ok({ measurement, profile });
});

export const DELETE = route(async () => {
  const user = await requireUser();
  await db.bodyMeasurement.deleteMany({ where: { userId: user.id } });
  return ok({ deleted: true });
});
