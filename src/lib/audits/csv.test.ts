import { describe, expect, it } from "vitest";
import { fuzzyMatchColumns, parseCsv } from "./csv";

/** The real reference sample's header row, verbatim — deliberately messy. */
const SAMPLE_HEADERS = [
  "QA name",
  "Phone Number",
  "Lead Link ( issue found or No Issue)",
  "Disposition",
  "QA Name",
  "Was the disposition accurately selected ?",
  "If not correct what is the real disposition",
  "Lead quality",
  "What can we improve",
  "Observation",
];

describe("fuzzyMatchColumns resolves the reference sample's real, messy headers", () => {
  const sampleRows = [
    {
      "QA name": "",
      "Phone Number": "+919876500001",
      "Lead Link ( issue found or No Issue)": "https://activate.convin.ai/leads/1",
      Disposition: "Hot",
      "QA Name": "Bhavya",
      "Was the disposition accurately selected ?": "Issue Found",
      "If not correct what is the real disposition": "warm",
      "Lead quality": "some free text, not a rating",
      "What can we improve": "Improve latency.",
      Observation: "Bot repeated itself.",
    },
  ];
  const matches = fuzzyMatchColumns(SAMPLE_HEADERS, sampleRows);

  it("maps disposition to the bare 'Disposition' header, not the accuracy question that also contains the word", () => {
    expect(matches.disposition?.header).toBe("Disposition");
  });

  it("maps accuracy to the trailing-space header despite its punctuation", () => {
    expect(matches.accuracy?.header).toBe("Was the disposition accurately selected ?");
  });

  it("maps correctedDisposition to the 'real disposition' header, not back to 'Disposition'", () => {
    expect(matches.correctedDisposition?.header).toBe("If not correct what is the real disposition");
  });

  it("picks the 'QA Name' header with real data over the empty 'QA name', despite identical normalization", () => {
    expect(matches.qaName?.header).toBe("QA Name");
  });

  it("maps link by its 'lead link' prefix, ignoring the misleading parenthetical", () => {
    expect(matches.link?.header).toBe("Lead Link ( issue found or No Issue)");
  });

  it("maps identifier, observation and improvement correctly", () => {
    expect(matches.identifier?.header).toBe("Phone Number");
    expect(matches.observation?.header).toBe("Observation");
    expect(matches.improvement?.header).toBe("What can we improve");
  });

  it("leaves the unused 'Lead quality' column unmapped to any role", () => {
    const mappedHeaders = Object.values(matches).map((m) => m?.header);
    expect(mappedHeaders).not.toContain("Lead quality");
  });
});

describe("parseCsv", () => {
  it("parses a well-formed CSV including a quoted field with an embedded newline", () => {
    const text = 'Disposition,Observation\nHot,"Line one\nline two"\nWarm,"single line"\n';
    const result = parseCsv(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].Observation).toBe("Line one\nline two");
    }
  });

  it("names the failing row on a malformed CSV, without a stack trace", () => {
    // Header has 3 fields; the second data row has only 2 — a dropped comma.
    const text = "Disposition,Accuracy,Observation\nHot,No issue,fine\nWarm,No issue\n";
    const result = parseCsv(text);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/row 3/i);
      expect(result.atRow).toBe(3);
    }
  });

  it("reports a header-only file as having no data rows", () => {
    const result = parseCsv("Disposition,Observation\n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/no data rows/i);
  });
});
