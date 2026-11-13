import { CURRENCY_LABEL, TEACHER_STATUS_LABELS } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

import type { TeacherFileDTO } from "../service";

/** Read-only view of the administrative section, with the halaqat assigned to the teacher. */
export function AdministrativeSummary({ teacher }: { teacher: TeacherFileDTO }) {
  const a = teacher.administrative;
  const rows: { label: string; value: string; ltr?: boolean; multiline?: boolean }[] = [
    { label: "الرقم الوظيفي", value: a.employeeNo, ltr: true },
    { label: "تاريخ الالتحاق", value: a.joinDate, ltr: true },
    { label: "نوع التعاقد", value: a.contractType },
    { label: "الحالة", value: TEACHER_STATUS_LABELS[a.status] },
    { label: "المكافأة الشهرية", value: a.monthlyPay === null ? "" : `${formatMoney(a.monthlyPay)} ${CURRENCY_LABEL}` },
    { label: "ملاحظات إدارية", value: a.adminNote, multiline: true },
    { label: "الحلقات المسندة", value: teacher.halaqat.map((h) => h.label).join("، ") },
    { label: "عدد الطلاب", value: String(teacher.studentCount), ltr: true },
  ];

  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 px-3 py-2.5">
          <dt className="font-medium text-muted-foreground">{row.label}</dt>
          <dd
            dir={row.ltr && row.value ? "ltr" : undefined}
            className={`${row.ltr && row.value ? "text-end" : ""} ${row.multiline ? "whitespace-pre-line" : ""}`}
          >
            {row.value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
