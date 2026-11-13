import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { TABLE_KEYS, TABLE_LABELS, type TableCounts } from "../backup/format";
import type { BackupReport } from "../backup/report";

/** Rows per table, with optional extra columns (e.g. «أُضيف» / «موجود من قبل» after a merge). */
export function CountsTable({ columns }: { columns: { label: string; counts: TableCounts }[] }) {
  const keys = TABLE_KEYS.filter((key) => columns.some((c) => c.counts[key]));
  if (!keys.length) return <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الجدول</TableHead>
          {columns.map((c) => (
            <TableHead key={c.label}>{c.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key}>
            <TableCell>{TABLE_LABELS[key]}</TableCell>
            {columns.map((c) => (
              <TableCell key={c.label}>{c.counts[key] ?? 0}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Rows left out and notes about a backup file. */
export function ReportDetails({ report }: { report: BackupReport }) {
  return (
    <>
      {report.skipped.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>سجلات لن تُستورد ({report.skipped.reduce((sum, s) => sum + s.count, 0)})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ps-5">
              {report.skipped.map((s) => (
                <li key={`${s.table}:${s.reason}`}>
                  {TABLE_LABELS[s.table]}: {s.count} — {s.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {report.notes.length > 0 && (
        <Alert>
          <AlertTitle>ملاحظات</AlertTitle>
          <AlertDescription>
            <ul className="list-disc ps-5">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
