import { describe, expect, it, vi } from "vitest";
import { claimAndSend, type ClaimStore } from "./claim";

/**
 * Models Postgres's own guarantee: a conditional UPDATE only ever succeeds
 * for the caller whose WHERE clause still matches when its row lock is
 * granted. The delay between reading and writing forces two "concurrent"
 * async calls to actually interleave — without it, JS's single-threaded
 * execution would make the race trivially unobservable.
 */
function fakeStore(initialStatus: string): ClaimStore & { status: string } {
  let status = initialStatus;
  return {
    get status() {
      return status;
    },
    async claim(_id, from, to) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (status !== from) return false;
      status = to;
      return true;
    },
  };
}

describe("claimAndSend — the atomic scheduled-send claim", () => {
  it("lets exactly one of two concurrent invocations send the same campaign", async () => {
    const store = fakeStore("scheduled");
    const send = vi.fn(async () => ({ ok: true as const }));

    const results = await Promise.all([
      claimAndSend(store, "camp-1", send),
      claimAndSend(store, "camp-1", send),
    ]);

    expect(results.sort()).toEqual(["sent", "skipped"]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.status).toBe("sent");
  });

  it("produces exactly one send across many concurrent invocations", async () => {
    const store = fakeStore("scheduled");
    const send = vi.fn(async () => ({ ok: true as const }));

    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimAndSend(store, "camp-1", send)),
    );

    expect(results.filter((r) => r === "sent")).toHaveLength(1);
    expect(results.filter((r) => r === "skipped")).toHaveLength(7);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("marks the campaign failed, not sent, when the send itself reports failure", async () => {
    const store = fakeStore("scheduled");
    const send = vi.fn(async () => ({ ok: false as const, reason: "provider rejected it" }));

    const outcome = await claimAndSend(store, "camp-2", send);

    expect(outcome).toBe("failed");
    expect(store.status).toBe("failed");
  });

  it("marks failed, never leaving the row stuck in 'sending', when send throws", async () => {
    const store = fakeStore("scheduled");
    const send = vi.fn(async () => {
      throw new Error("network down");
    });

    const outcome = await claimAndSend(store, "camp-3", send);

    expect(outcome).toBe("failed");
    expect(store.status).toBe("failed");
  });

  it("never calls send when the row is not actually scheduled", async () => {
    const store = fakeStore("sent");
    const send = vi.fn(async () => ({ ok: true as const }));

    const outcome = await claimAndSend(store, "camp-4", send);

    expect(outcome).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
    expect(store.status).toBe("sent");
  });
});
