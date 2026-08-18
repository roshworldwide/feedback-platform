import { describe, expect, it } from "vitest";
import { activeOnly, isMine, type RecipientChoice } from "./vocabulary";

function person(overrides: Partial<RecipientChoice>): RecipientChoice {
  return {
    key: "k",
    contactId: "c",
    email: "person@client.com",
    fullName: "A Person",
    title: "",
    isInternal: false,
    bouncedAt: null,
    isActive: true,
    ...overrides,
  };
}

describe("activeOnly — the unsubscribe/complaint exclusion", () => {
  it("keeps an active contact in the recipient list", () => {
    const list = activeOnly([person({ isActive: true })]);
    expect(list).toHaveLength(1);
  });

  it("removes a contact from the recipient list the moment they are inactive", () => {
    // The exact effect an unsubscribe or a spam complaint has: the webhook
    // and the /u/[token] route both set `contacts.is_active = false`, and
    // this is the rule `resolveRecipients` enforces (belt-and-suspenders
    // alongside the `is_active = true` filter in the contacts query itself)
    // — a subsequent send must never reach them again.
    const before = [
      person({ key: "still-subscribed", email: "a@client.com", isActive: true }),
      person({ key: "just-unsubscribed", email: "b@client.com", isActive: true }),
    ];

    // The moment b@client.com unsubscribes:
    const after = before.map((p) => (p.key === "just-unsubscribed" ? { ...p, isActive: false } : p));

    const eligible = activeOnly(after);

    expect(eligible.map((p) => p.email)).toEqual(["a@client.com"]);
    expect(eligible.some((p) => p.email === "b@client.com")).toBe(false);
  });

  it("returns an empty list when everyone has unsubscribed", () => {
    const list = activeOnly([person({ isActive: false }), person({ isActive: false })]);
    expect(list).toHaveLength(0);
  });
});

describe("isMine — the ownership check `card.ownerId === me` used to be", () => {
  const id = "3f6a2b10-0c1e-4a9d-9e2b-1d7c6f0a5b3e";

  it("is true when the owner and the signed-in person are the same id", () => {
    expect(isMine(id, id)).toBe(true);
  });

  it("is false for two different real ids", () => {
    expect(isMine(id, "a1b2c3d4-0000-0000-0000-000000000000")).toBe(false);
  });

  it("is false when nobody owns the row, even for a signed-in person", () => {
    expect(isMine(null, id)).toBe(false);
  });

  it("is false when nobody is signed in, even for an owned row", () => {
    expect(isMine(id, null)).toBe(false);
  });

  it("is false when both sides are null — no shared absence counts as a match", () => {
    expect(isMine(null, null)).toBe(false);
  });

  it("compares by coerced string, so a stray non-string id can never false-match", () => {
    // The exact regression this guards: `getSessionProfile()`'s `id` used to
    // come back typed `any` from an ungenerated query builder, so nothing
    // caught it if that ever stopped being a string.
    expect(isMine(String(1), String(1))).toBe(true);
    expect(isMine("1", "01")).toBe(false);
  });
});
