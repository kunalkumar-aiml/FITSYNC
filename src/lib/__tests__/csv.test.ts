import { describe, expect, it } from "vitest";
import { parseChartCsv } from "../csv";

describe("parseChartCsv", () => {
  it("parses ranges and converts inches to cm", () => {
    const r = parseChartCsv("label,chest,waist\nS,35-37.5,29-32\nM,37.5-41,32-35", "IN");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ label: "S", chest: 88.9, chestMax: 95.3, waist: 73.7, waistMax: 81.3 });
    expect(r.dimensions).toEqual(["chest", "waist"]);
  });
  it("accepts cm, single values, min/max columns, BOM, CRLF and tabs", () => {
    expect(parseChartCsv("\uFEFFlabel,chest\r\nS,90\r\nM,96\r\n", "CM").rows).toHaveLength(2);
    const mm = parseChartCsv("label,chest_min,chest_max\nS,88,92\nM,92,96", "CM");
    expect(mm.errors).toEqual([]);
    expect(mm.rows[1]).toMatchObject({ chest: 92, chestMax: 96 });
    expect(parseChartCsv("label\tchest\nS\t90\nM\t96", "CM").rows).toHaveLength(2);
    expect(parseChartCsv('label,chest\n"S",90\n"M",96', "CM").rows[0].label).toBe("S");
  });
  it("rejects open-ended values instead of inventing a bound", () => {
    const r = parseChartCsv("label,chest\nXXS,<31\nS,31-33.5", "IN");
    expect(r.rows).toEqual([]);
    expect(r.errors.join(" ")).toMatch(/open-ended/);
  });
  it("reports line numbers for bad data and saves nothing", () => {
    const r = parseChartCsv("label,chest\nS,abc\nM,96\nM,99", "CM");
    expect(r.rows).toEqual([]);
    expect(r.errors.some((e) => e.startsWith("Line 2"))).toBe(true);
    expect(r.errors.some((e) => /duplicate/.test(e))).toBe(true);
  });
  it("catches unit mistakes, reversed ranges, unknown columns, bad headers and too-small input", () => {
    expect(parseChartCsv("label,chest\nS,9\nM,96", "CM").errors.join()).toMatch(/looks wrong/);
    expect(parseChartCsv("label,chest\nS,40-30\nM,96", "CM").errors.join()).toMatch(/min above max/);
    expect(parseChartCsv("label,bust\nS,90\nM,96", "CM").errors.join()).toMatch(/unknown column/);
    expect(parseChartCsv("size,chest\nS,90\nM,96", "CM").errors.join()).toMatch(/"label"/);
    expect(parseChartCsv("label,chest\nS,90", "CM").errors.join()).toMatch(/at least two/);
  });
});
