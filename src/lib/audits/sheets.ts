/**
 * Google Sheets ingestion — the alternative to a direct CSV upload. Only
 * works for a sheet shared as "Anyone with the link can view"; there's no
 * OAuth flow here, so a private sheet fails with a sentence that says so
 * rather than a fetch error.
 */

import "server-only";

export function sheetsUrlToCsvExportUrl(url: string): string | null {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[?#&]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

export type FetchSheetResult = { ok: true; text: string } | { ok: false; message: string };

export async function fetchSheetCsv(url: string): Promise<FetchSheetResult> {
  const exportUrl = sheetsUrlToCsvExportUrl(url);
  if (!exportUrl) {
    return { ok: false, message: "That doesn't look like a Google Sheets URL." };
  }
  try {
    const response = await fetch(exportUrl, { redirect: "follow" });
    if (!response.ok) {
      const notShared = response.status === 401 || response.status === 403 || response.status === 404;
      return {
        ok: false,
        message: notShared
          ? 'This sheet isn\'t shared as "Anyone with the link can view." Share it that way and try again, or upload the CSV directly.'
          : `Couldn't fetch the sheet (${response.status}).`,
      };
    }
    return { ok: true, text: await response.text() };
  } catch {
    return { ok: false, message: "Couldn't reach Google Sheets. Check the URL and try again." };
  }
}
