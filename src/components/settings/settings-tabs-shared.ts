/**
 * The five settings surfaces.
 *
 * Kept out of the "use client" module: a Server Component needs to call
 * `settingsTabFrom` while resolving `searchParams`, and every export of a
 * "use client" file becomes an opaque client reference — a plain function
 * export from one cannot be invoked on the server.
 */

export const SETTINGS_TABS = [
  { value: "team", label: "Team" },
  { value: "sender", label: "Sender" },
  { value: "appearance", label: "Appearance" },
  { value: "data", label: "Data" },
  { value: "audit", label: "Audit log" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

export function settingsTabFrom(value: unknown): SettingsTab {
  const found = SETTINGS_TABS.find((tab) => tab.value === value);
  return found?.value ?? "team";
}
