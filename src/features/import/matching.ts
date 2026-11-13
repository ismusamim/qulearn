/**
 * Turns a raw spreadsheet table into importable rows:
 *   1. find the header row (the first of the top five that has a «الاسم» column),
 *   2. match every other column to a system field; unmatched ones are «معلّق»
 *      (kept as pending columns for the admin to approve later),
 *   3. after the admin has reviewed the mapping, build the rows to send.
 */
import { toLatinDigits } from "@/lib/arabic";

import { type FieldTarget, isNameHeader, matchHeader, TARGET_HALAQA } from "./fields";
import type { Table } from "./parse/csv";

/** Mapping choices besides a target id. */
export const MAP_PENDING = "pending";
export const MAP_SKIP = "skip";

export interface ColumnMatch {
  /** Column index in the source table. */
  index: number;
  header: string;
  /** A target id, MAP_PENDING or MAP_SKIP. */
  target: string;
}

export interface TableAnalysis {
  nameColumn: number;
  columns: ColumnMatch[];
  /** Data rows (after the header row), cells trimmed. */
  rows: string[][];
}

export type AnalysisResult = { ok: true; analysis: TableAnalysis } | { ok: false; error: string };

const HEADER_SEARCH_ROWS = 5;

export function analyzeTable(table: Table, targets: readonly FieldTarget[]): AnalysisResult {
  const grid = table.map((row) => Array.from(row ?? [], (cell) => String(cell ?? "").trim()));

  let headerRow = -1;
  let nameColumn = -1;
  for (let i = 0; i < Math.min(grid.length, HEADER_SEARCH_ROWS) && headerRow < 0; i++) {
    const j = grid[i].findIndex(isNameHeader);
    if (j >= 0) {
      headerRow = i;
      nameColumn = j;
    }
  }
  if (headerRow < 0) {
    return { ok: false, error: "لم أجد عمود «الاسم» في الصف الأول. استخدم القالب أو أضف عنوانًا للعمود." };
  }

  const columns: ColumnMatch[] = [];
  const taken = new Set<string>();
  grid[headerRow].forEach((header, index) => {
    if (!header || index === nameColumn) return;
    const target = matchHeader(header, targets);
    if (!target) columns.push({ index, header, target: MAP_PENDING });
    else if (!taken.has(target.id)) {
      taken.add(target.id);
      columns.push({ index, header, target: target.id });
    } else {
      // A second column for a field already matched: ignored unless the admin remaps it.
      columns.push({ index, header, target: MAP_SKIP });
    }
  });

  const rows = grid.slice(headerRow + 1).filter((r) => (r[nameColumn] ?? "") !== "");
  if (!rows.length) return { ok: false, error: "لا توجد صفوف بيانات بعد صف العناوين." };
  return { ok: true, analysis: { nameColumn, columns, rows } };
}

/** Targets chosen for more than one column (each field can be fed by one column only). */
export function duplicateTargets(columns: readonly ColumnMatch[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const c of columns) {
    if (c.target === MAP_PENDING || c.target === MAP_SKIP) continue;
    if (seen.has(c.target)) dup.add(c.target);
    seen.add(c.target);
  }
  return [...dup];
}

export interface ImportColumn {
  header: string;
  /** A target id, or null for a pending column. */
  target: string | null;
}

export interface ImportRow {
  name: string;
  /** One value per ImportColumn. */
  values: string[];
}

export interface ImportTable {
  columns: ImportColumn[];
  rows: ImportRow[];
}

/**
 * The payload for the server: skipped columns removed, names with single
 * spaces, Arabic-Indic digits converted (except in halaqa names, which are
 * matched as text).
 */
export function buildImportTable(analysis: TableAnalysis, columns: readonly ColumnMatch[]): ImportTable {
  const kept = columns.filter((c) => c.target !== MAP_SKIP);
  return {
    columns: kept.map((c) => ({ header: c.header, target: c.target === MAP_PENDING ? null : c.target })),
    rows: analysis.rows.map((r) => ({
      name: (r[analysis.nameColumn] ?? "").replace(/\s+/g, " ").trim(),
      values: kept.map((c) => {
        const raw = r[c.index] ?? "";
        return c.target === TARGET_HALAQA ? raw : toLatinDigits(raw).trim();
      }),
    })),
  };
}

/** How a halaqa cell may be written: «حلقة فلان» or just «فلان». Returns both spellings. */
export function halaqaQueryKeys(value: string, normalize: (s: string) => string): string[] {
  return [normalize(value), normalize(value.replace(/^\s*حلقة\s+/, ""))];
}
