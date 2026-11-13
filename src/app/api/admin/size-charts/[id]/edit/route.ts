import { db } from "@/lib/db";
import { ApiError, ok, parseBody, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { editVersionSchema } from "@/lib/schemas";
import { logAdmin } from "@/lib/audit";
import { round1, type ChartRow } from "@/lib/engine";
export const dynamic = "force-dynamic";

const FLAT_CONVERTIBLE = ["chest", "waist", "hips", "thigh"] as const;

/**
 * Corrections never overwrite history: they create a NEW unverified version (v+1) and log an EDITED decision.
 * Resolving an ambiguous measurement is a human statement of what it is, recorded per dimension in measurementSemantics.
 * A flat garment width can be converted to a circumference (x2) only when the admin explicitly asks for it.
 */
export const POST = route(async (req: Request, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, editVersionSchema);
  const v = await db.brandSizeChartVersion.findUnique({ where: { id: params.id } });
  if (!v) throw new ApiError(404, "Chart version not found.");
  const semantics: Record<string, string> = { ...((v.measurementSemantics as Record<string, string>) ?? {}), ...(input.resolveSemantics ?? {}) };
  let rows = (input.rows ?? (v.rows as unknown as ChartRow[])).map((r) => ({ ...r })) as Record<string, number | string>[];
  const converted: string[] = [];
  if (input.convertFlatToCircumference) {
    const flat = Object.entries(semantics).filter(([, s]) => s === "GARMENT_WIDTH_FLAT").map(([d]) => d);
    const bad = flat.filter((d) => !(FLAT_CONVERTIBLE as readonly string[]).includes(d));
    if (!flat.length) throw new ApiError(400, "No dimension is marked as a flat width.");
    if (bad.length) throw new ApiError(400, `Only chest, waist, hips and thigh flat widths can be converted (not ${bad.join(", ")}).`);
    rows = rows.map((r) => {
      const o = { ...r };
      for (const d of flat) for (const k of [d, `${d}Max`]) if (typeof o[k] === "number") o[k] = round1((o[k] as number) * 2);
      return o;
    });
    for (const d of flat) { semantics[d] = "GARMENT_CIRCUMFERENCE"; converted.push(d); }
  }
  const resolved = Object.keys(input.resolveSemantics ?? {});
  const amb = ((v.ambiguousDimensions as string[]) ?? []).filter((d) => !resolved.includes(d));
  // Chart-level type follows the per-dimension meanings once nothing is ambiguous.
  const kinds = new Set(Object.entries(semantics).filter(([d]) => !["garmentLength", "sleeveLength", "rise", "legOpening"].includes(d)).map(([, s]) => s.startsWith("BODY") ? "BODY" : s.startsWith("GARMENT") ? "GARMENT" : "AMBIGUOUS"));
  const derived = amb.length || kinds.has("AMBIGUOUS") ? undefined : kinds.size === 1 ? [...kinds][0] : kinds.size > 1 ? "MIXED" : undefined;
  const last = await db.brandSizeChartVersion.findFirst({ where: { chartId: v.chartId }, orderBy: { version: "desc" } });
  const noteParts = [input.note, converted.length ? `Flat width converted to circumference (x2) for ${converted.join(", ")} by an admin.` : ""].filter(Boolean).join(" ");
  const created = await db.brandSizeChartVersion.create({
    data: {
      chartId: v.chartId, version: (last?.version ?? 0) + 1, rows: rows as object, measurementType: input.measurementType ?? derived ?? v.measurementType,
      sourceType: v.sourceType, originalUnit: v.originalUnit, retrievedAt: v.retrievedAt, sourceDomain: v.sourceDomain, extractionMethod: "ADMIN_EDIT",
      sourceUrl: v.sourceUrl, sourceNote: `${v.sourceNote ?? ""}\nEdit: ${noteParts}`.trim(), status: "UNVERIFIED",
      measurementSemantics: semantics as object, ambiguousDimensions: amb as object,
    },
  });
  await db.dataVerification.create({ data: { chartVersionId: created.id, action: "EDITED", adminId: admin.id, note: noteParts } });
  await logAdmin(admin, "chart.edit", "BrandSizeChartVersion", created.id, { fromVersion: v.id, resolved, converted, rowsChanged: !!input.rows });
  return ok(created, 201);
});
