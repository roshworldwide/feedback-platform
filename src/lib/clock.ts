import "server-only";

/**
 * The server's clock, read once per request.
 *
 * Relative ages ("no report in 47 days") must be measured against a single
 * instant that is captured on the server and passed down, not against
 * `Date.now()` evaluated separately in the server render and again during
 * hydration — those are two different instants and they produce two different
 * strings for the same row.
 *
 * This is deliberately a function in a server-only module rather than an inline
 * `Date.now()` in a component body: reading a clock during render is impure,
 * and the purity lint is right to say so. Naming it here marks it as a
 * request-scoped input rather than an accident.
 */
export function serverNow(): number {
  return Date.now();
}
