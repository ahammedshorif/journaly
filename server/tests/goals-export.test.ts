import { describe, expect, it } from "vitest";
import { currentLossStreak, dailyLossProgress, monthlyProfitProgress } from "../src/domain/goals";
import { csvCell, toCsv } from "../src/utils/csv";
import { createPdf, drawTable, pdfSafe, pdfToBuffer, sectionTitle } from "../src/utils/pdf";

describe("monthlyProfitProgress", () => {
  it("partway", () => {
    expect(monthlyProfitProgress("1000", "250")).toMatchObject({ percent: 25, status: "on_track", remaining: "750.00" });
  });
  it("achieved", () => {
    expect(monthlyProfitProgress("1000", "1200.5")).toMatchObject({ percent: 120.1, status: "achieved", remaining: "0.00" });
  });
  it("a losing month shows 0%, not negative", () => {
    expect(monthlyProfitProgress("1000", "-300")).toMatchObject({ percent: 0, current: "-300.00" });
  });
});

describe("dailyLossProgress", () => {
  it("profitable day uses none of the limit", () => {
    expect(dailyLossProgress("200", "50")).toMatchObject({ percent: 0, status: "ok", remaining: "200.00" });
  });
  it("warning from 75%", () => {
    expect(dailyLossProgress("200", "-150")).toMatchObject({ percent: 75, status: "warning", remaining: "50.00" });
  });
  it("breached at or past 100%", () => {
    expect(dailyLossProgress("200", "-200").status).toBe("breached");
    expect(dailyLossProgress("200", "-260")).toMatchObject({ percent: 130, status: "breached", remaining: "0.00" });
  });
});

describe("currentLossStreak", () => {
  it("counts trailing losses only", () => {
    expect(currentLossStreak(["LOSS", "PROFIT", "LOSS", "LOSS", "LOSS"])).toBe(3);
    expect(currentLossStreak(["LOSS", "LOSS", "BREAKEVEN"])).toBe(0);
    expect(currentLossStreak([])).toBe(0);
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('He said "go", then\nleft')).toBe('"He said ""go"", then\nleft"');
  });
  it("neutralises spreadsheet formulas in text", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
  it("leaves negative numbers alone", () => {
    expect(csvCell("-12.50")).toBe("-12.50");
    expect(csvCell(-3)).toBe("-3");
  });
  it("adds a UTF-8 BOM and CRLF rows", () => {
    expect(toCsv([["a", 1], ["b", null]])).toBe("﻿a,1\r\nb,\r\n");
  });
});

describe("PDF", () => {
  it("strips characters the built-in fonts can't render", () => {
    expect(pdfSafe("FOMO 🏃 trade – BTC")).toBe("FOMO  trade – BTC");
  });
  it("renders a multi-page table to a valid PDF", async () => {
    const doc = createPdf("Test report", "subtitle");
    sectionTitle(doc, "Rows");
    drawTable(
      doc,
      [
        { header: "Key", width: 2 },
        { header: "Value", width: 1, align: "right" },
      ],
      Array.from({ length: 120 }, (_, i) => [`row ${i}`, String(i - 60)]),
    );
    const buf = await pdfToBuffer(doc);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });
});
