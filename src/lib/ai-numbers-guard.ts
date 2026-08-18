/**
 * AI Check must never invent a figure. Kept as a pure, dependency-free leaf so
 * it is unit-testable without booting the environment layer — `ai.ts` imports
 * `serverEnv()`, which throws at import time outside a fully-configured
 * runtime, and this guard has no reason to carry that cost.
 */

export function numbersOf(text: string): string[] {
  return text.match(/\d[\d,.:%]*/g) ?? [];
}

export function numbersPreserved(original: string, revised: string): boolean {
  const before = numbersOf(original).slice().sort();
  const after = numbersOf(revised).slice().sort();
  if (before.length !== after.length) return false;
  return before.every((value, index) => value === after[index]);
}
