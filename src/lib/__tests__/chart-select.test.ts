import { describe, expect, it } from "vitest";
import { selectChart, type ChartCandidate } from "../chart-select";

const c = (id: string, gender: ChartCandidate["gender"], region = "GLOBAL", fitCut = "REGULAR", productLine = ""): ChartCandidate => ({ id, gender, region, fitCut, productLine });

describe("selectChart", () => {
  it("never mixes men's and women's charts", () => {
    expect(selectChart([c("w", "WOMEN")], "MEN", "REGULAR")).toBeNull();
    expect(selectChart([c("m", "MEN")], "WOMEN", "REGULAR")).toBeNull();
  });
  it("prefers the exact gender over unisex, and allows unisex as a fallback", () => {
    expect(selectChart([c("u", "UNISEX"), c("m", "MEN")], "MEN", "REGULAR")!.chart.id).toBe("m");
    expect(selectChart([c("u", "UNISEX")], "WOMEN", "REGULAR")!.chart.id).toBe("u");
  });
  it("respects region: requested > IN > GLOBAL > others", () => {
    const charts = [c("g", "MEN", "GLOBAL"), c("a", "MEN", "ASIA"), c("i", "MEN", "IN")];
    expect(selectChart(charts, "MEN", "REGULAR")!.chart.id).toBe("i");
    expect(selectChart(charts, "MEN", "REGULAR", "ASIA")!.chart.id).toBe("a");
    expect(selectChart(charts.filter((x) => x.id !== "i"), "MEN", "REGULAR")!.chart.id).toBe("g");
  });
  it("matches the garment cut to the shopper's fit preference, else REGULAR", () => {
    const charts = [c("reg", "MEN", "GLOBAL", "REGULAR"), c("ovr", "MEN", "GLOBAL", "OVERSIZED")];
    expect(selectChart(charts, "MEN", "OVERSIZED")!.chart.id).toBe("ovr");
    expect(selectChart(charts, "MEN", "SLIM")!.chart.id).toBe("reg");
  });
  it("is deterministic regardless of input order", () => {
    const charts = [c("b", "MEN", "ASIA"), c("a", "MEN", "ASIA", "REGULAR", "x"), c("c", "MEN", "EU")];
    expect(selectChart(charts, "MEN", "REGULAR")!.chart.id).toBe(selectChart([...charts].reverse(), "MEN", "REGULAR")!.chart.id);
  });
});
