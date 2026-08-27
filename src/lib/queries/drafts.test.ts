import { describe, expect, it, vi } from "vitest";

/**
 * The scenario a live send hit: Thyrocare runs two report series (seeded as
 * "DeGrowth Analysis — Farming Teams" and "Competitors & Reasons"). DL-099
 * was already used on one of them. report_number carries no uniqueness
 * constraint (reuse is intentional, see 0014_report_number_reusable.sql), so
 * this suggestion is a convenience default rather than a collision check —
 * but a useful default still has to look at the client's actual numbering,
 * not a subset of it.
 *
 * An earlier version added `.eq("series_id", seriesId)` to the query and
 * took a `seriesId` parameter to feed it. Looking only inside "DeGrowth" it
 * saw DL-003 as the highest number and suggested DL-004, silently lower than
 * DL-099 on "Competitors & Reasons" for the very same client. The fix
 * removed the parameter entirely, not just stopped using it: there is now
 * nothing for a caller to narrow by. Both the removed parameter and the
 * removed filter are asserted below.
 */

type Row = { client_id: string; report_number: string | null; series_id: string | null };

function fakeSupabase(rows: Row[]) {
  function builder(filters: Array<(row: Row) => boolean>) {
    return {
      select: () => builder(filters),
      not: (col: keyof Row) => builder([...filters, (row) => row[col] !== null]),
      eq: (col: keyof Row, value: unknown) => builder([...filters, (row) => row[col] === value]),
      limit: () =>
        Promise.resolve({
          data: rows.filter((row) => filters.every((matches) => matches(row))),
          error: null,
        }),
    };
  }
  return { from: () => builder([]) };
}

const THYROCARE = "thyrocare-id";

const TWO_SERIES_ROWS: Row[] = [
  { client_id: THYROCARE, report_number: "DL-099", series_id: "series-competitors" },
  { client_id: THYROCARE, report_number: "DL-003", series_id: "series-degrowth" },
];

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

describe("suggestReportNumber — one sequence per client, never per series", () => {
  it("takes no series parameter to narrow by", async () => {
    const { suggestReportNumber } = await import("./drafts");
    expect(suggestReportNumber.length).toBe(1);
  });

  it("accounts for a number already used on the client's other series", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase(TWO_SERIES_ROWS) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const { suggestReportNumber } = await import("./drafts");
    const result = await suggestReportNumber(THYROCARE);

    // A view scoped to "series-degrowth" alone would see only DL-003 and
    // suggest DL-004 — a real, if no longer forbidden, undercount against
    // "series-competitors" for this same client's actual highest number.
    expect(result).toEqual({ ok: true, data: "DL-100" });
  });

  it("suggests DL-001 for a client with no prior numbers", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      fakeSupabase([]) as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const { suggestReportNumber } = await import("./drafts");
    const result = await suggestReportNumber("brand-new-client-id");

    expect(result).toEqual({ ok: true, data: "DL-001" });
  });
});
