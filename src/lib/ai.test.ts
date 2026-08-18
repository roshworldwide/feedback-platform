import { describe, expect, it } from "vitest";
import { numbersOf, numbersPreserved } from "./ai-numbers-guard";

describe("AI Check must never invent a figure", () => {
  it("passes when every number survives, in any order", () => {
    const original = "Resolution time fell to 4.2 hours across 1,240 conversations.";
    const revised = "Across 1,240 conversations, resolution time dropped to 4.2 hours.";
    expect(numbersPreserved(original, revised)).toBe(true);
  });

  it("fails when a number is changed", () => {
    const original = "CSAT held at 4.6 across 1,240 conversations.";
    const revised = "CSAT held at 4.9 across 1,240 conversations.";
    expect(numbersPreserved(original, revised)).toBe(false);
  });

  it("fails when a number is dropped", () => {
    const original = "Delivered to 160 recipients, 23 opened.";
    const revised = "Delivered to 160 recipients.";
    expect(numbersPreserved(original, revised)).toBe(false);
  });

  it("fails when a number is added", () => {
    const original = "The report landed well.";
    const revised = "The report landed well, with 98% approval.";
    expect(numbersPreserved(original, revised)).toBe(false);
  });

  it("extracts percentages and decimals as single tokens", () => {
    expect(numbersOf("14.4% open rate, 3 clicks")).toEqual(["14.4%", "3"]);
  });
});
