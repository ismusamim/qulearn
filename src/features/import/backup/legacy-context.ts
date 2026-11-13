import { type BackupData, type BackupTable, emptyBackupData, rowSchemas } from "./format";
import { IdMapper } from "./legacy-ids";
import { ReportBuilder } from "./report";

/** Scopes of IdMapper: one per old collection. */
export const STAFF_SCOPES = ["teachers", "supervisors", "admins", "accountants"] as const;
export const MEMBER_SCOPES = [...STAFF_SCOPES, "students"] as const;

/** Shared state of one legacy conversion. */
export class LegacyContext {
  readonly data: BackupData = emptyBackupData();
  readonly ids = new IdMapper();
  readonly report = new ReportBuilder();
  /** Plain passwords of the old app by new member id; hashed by the server when applied. */
  readonly pins: Record<string, string> = {};
  payrollPin: string | null = null;

  constructor(readonly today: string) {}

  /** Validates one row against the format and stores it; an invalid row is reported, not thrown. */
  add<K extends BackupTable>(table: K, row: unknown): boolean {
    const parsed = rowSchemas[table].safeParse(row);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path.join(".") ?? "";
      this.report.skip(table, field ? `قيمة غير صالحة في «${field}»` : "بيانات غير صالحة");
      return false;
    }
    (this.data[table] as unknown[]).push(parsed.data);
    return true;
  }
}
