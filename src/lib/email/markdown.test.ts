import { describe, expect, it } from "vitest";
import { reportOrdinalOf } from "./markdown";

describe("reportOrdinalOf — the DL-template ordinal helper", () => {
  it("gets the ordinary cases right", () => {
    expect(reportOrdinalOf("DL-1")).toBe("1st");
    expect(reportOrdinalOf("DL-2")).toBe("2nd");
    expect(reportOrdinalOf("DL-3")).toBe("3rd");
    expect(reportOrdinalOf("DL-4")).toBe("4th");
    expect(reportOrdinalOf("DL-098")).toBe("98th");
  });

  it("gets the 11/12/13 exception right, including across hundreds", () => {
    expect(reportOrdinalOf("DL-11")).toBe("11th");
    expect(reportOrdinalOf("DL-12")).toBe("12th");
    expect(reportOrdinalOf("DL-13")).toBe("13th");
    expect(reportOrdinalOf("DL-111")).toBe("111th");
    expect(reportOrdinalOf("DL-112")).toBe("112th");
    expect(reportOrdinalOf("DL-113")).toBe("113th");
  });

  it("resumes st/nd/rd immediately after the 11-13 exception", () => {
    expect(reportOrdinalOf("DL-21")).toBe("21st");
    expect(reportOrdinalOf("DL-22")).toBe("22nd");
    expect(reportOrdinalOf("DL-23")).toBe("23rd");
    expect(reportOrdinalOf("DL-101")).toBe("101st");
  });

  it("reads the last run of digits, not the first", () => {
    expect(reportOrdinalOf("DL-2026-034")).toBe("34th");
  });

  it("falls back to a word when there is no number to read", () => {
    expect(reportOrdinalOf("")).toBe("next");
    expect(reportOrdinalOf("DL-")).toBe("next");
  });
});
