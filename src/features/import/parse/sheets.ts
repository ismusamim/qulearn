/**
 * Google Sheets links. The CSV is fetched by the server (the browser cannot,
 * because of CORS), so the URL the server requests is rebuilt from scratch
 * out of the validated spreadsheet id and gid — nothing else from the
 * user-supplied link survives. That is what prevents SSRF.
 */

export const SHEETS_HOST = "docs.google.com";

export interface SheetRef {
  id: string;
  gid: string | null;
}

/** Extracts the spreadsheet id (and tab gid) from a share link; null when it is not a Google Sheets link. */
export function parseSheetUrl(raw: string): SheetRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== SHEETS_HOST || url.port !== "" || url.username || url.password) {
    return null;
  }
  const id = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/.exec(url.pathname)?.[1];
  if (!id) return null;
  const gid = /[#&?]gid=(\d{1,20})(?:&|$)/.exec(url.search + url.hash)?.[1] ?? null;
  return { id, gid };
}

/** The CSV export endpoint for a sheet shared with «أي شخص لديه الرابط». */
export function sheetCsvUrl(ref: SheetRef): string {
  return `https://${SHEETS_HOST}/spreadsheets/d/${ref.id}/gviz/tq?tqx=out:csv${ref.gid ? `&gid=${ref.gid}` : ""}`;
}
