import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { svixHeadersFrom, verifySvixSignature } from "./svix";

const SECRET = "whsec_" + Buffer.from("a-test-signing-key-32-bytes-long").toString("base64");

function sign(id: string, timestamp: string, body: string): string {
  const key = Buffer.from(SECRET.slice("whsec_".length), "base64");
  const digest = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return `v1,${digest}`;
}

function headersFor(id: string, timestamp: string, signature: string) {
  return svixHeadersFrom(
    new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": signature }),
  );
}

describe("verifySvixSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ type: "email.delivered" });
    const now = String(Math.floor(Date.now() / 1000));
    const signature = sign("msg_1", now, body);

    const result = verifySvixSignature(headersFor("msg_1", now, signature), body, SECRET);

    expect(result.ok).toBe(true);
  });

  it("accepts a body when any signature in a multi-key header matches", () => {
    const body = JSON.stringify({ type: "email.bounced" });
    const now = String(Math.floor(Date.now() / 1000));
    const real = sign("msg_2", now, body);
    const header = `v1,not-a-real-signature ${real}`;

    const result = verifySvixSignature(headersFor("msg_2", now, header), body, SECRET);

    expect(result.ok).toBe(true);
  });

  it("rejects a body that was tampered with after signing", () => {
    const signedBody = JSON.stringify({ type: "email.delivered" });
    const now = String(Math.floor(Date.now() / 1000));
    const signature = sign("msg_3", now, signedBody);
    const tamperedBody = JSON.stringify({ type: "email.complained" });

    const result = verifySvixSignature(headersFor("msg_3", now, signature), tamperedBody, SECRET);

    expect(result.ok).toBe(false);
  });

  it("rejects a signature produced with a different secret", () => {
    const body = JSON.stringify({ type: "email.delivered" });
    const now = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(Buffer.from("a-completely-different-key-material").toString("base64"), "base64");
    const wrongSignature = `v1,${createHmac("sha256", key).update(`msg_4.${now}.${body}`).digest("base64")}`;

    const result = verifySvixSignature(headersFor("msg_4", now, wrongSignature), body, SECRET);

    expect(result.ok).toBe(false);
  });

  it("rejects a timestamp far outside the tolerance window", () => {
    const body = JSON.stringify({ type: "email.delivered" });
    const old = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const signature = sign("msg_5", old, body);

    const result = verifySvixSignature(headersFor("msg_5", old, signature), body, SECRET);

    expect(result.ok).toBe(false);
  });

  it("rejects when a header is missing entirely", () => {
    const result = verifySvixSignature(
      svixHeadersFrom(new Headers({ "svix-id": "msg_6" })),
      "{}",
      SECRET,
    );

    expect(result.ok).toBe(false);
  });
});
