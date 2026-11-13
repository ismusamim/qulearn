/**
 * Delimited text → table of strings. Handles what spreadsheets actually
 * produce: a BOM, tab / semicolon / comma delimiters (cells pasted from Excel
 * or Google Sheets are tab-separated), quoted cells with embedded delimiters,
 * doubled quotes and line breaks, and CRLF line endings.
 */

export type Table = string[][];

const DELIMITERS = ["\t", ";", ","] as const;

/** The delimiter that splits the first line into the most cells (tab wins ties, then semicolon). */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/)[0] ?? "";
  let best: string = DELIMITERS[0];
  let bestCount = -1;
  for (const d of DELIMITERS) {
    const count = first.split(d).length;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseCSV(input: string): Table {
  const text = String(input).replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: Table = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** CSV files saved by Arabic Excel are often Windows-1256 rather than UTF-8. */
export function decodeText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1256").decode(buffer);
  }
}
