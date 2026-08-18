import { describe, expect, it } from "vitest";
import { activeOnly, type RecipientChoice } from "./vocabulary";

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
