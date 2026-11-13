import type { BackupData, TableCounts } from "./format";

/** Rows left out of an import, grouped by table and reason. */
export interface SkippedGroup {
  table: keyof BackupData;
  reason: string;
  count: number;
}

/** What a conversion / integrity pass found, for the admin to read before applying. */
export interface BackupReport {
  counts: TableCounts;
  skipped: SkippedGroup[];
  /** Things that were imported but changed or deserve attention. */
  notes: string[];
}

/** Collects skipped rows and notes while a backup is being converted or checked. */
export class ReportBuilder {
  private readonly groups = new Map<string, SkippedGroup>();
  private readonly noteSet = new Set<string>();

  skip(table: keyof BackupData, reason: string, count = 1): void {
    if (count <= 0) return;
    const key = `${table}|${reason}`;
    const group = this.groups.get(key);
    if (group) group.count += count;
    else this.groups.set(key, { table, reason, count });
  }

  note(message: string): void {
    this.noteSet.add(message);
  }

  get skipped(): SkippedGroup[] {
    return [...this.groups.values()];
  }

  get notes(): string[] {
    return [...this.noteSet];
  }
}
