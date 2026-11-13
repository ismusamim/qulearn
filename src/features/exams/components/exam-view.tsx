import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { surahName } from "@/lib/quran";

import type { ExamDetailDTO } from "../service";
import { ExamScore, ExamTypeBadge } from "./exam-type-badge";

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/** Read-only, printable result of one exam. */
export function ExamView({ exam }: { exam: ExamDetailDTO }) {
  const percent = exam.total != null && exam.maxScore ? Math.round((exam.total * 100) / exam.maxScore) : null;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{exam.studentName}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Item label="الحلقة">{exam.halaqaLabel || "—"}</Item>
            <Item label="النوع">
              <ExamTypeBadge type={exam.type} juz={exam.juz} levelName={exam.levelName} />
            </Item>
            {exam.type === "COMPETITION" && <Item label="المسابقة">{exam.competitionName || "—"}</Item>}
            <Item label="التاريخ">
              <span dir="ltr">{exam.date}</span>
            </Item>
            <Item label="المختبِر">{exam.examinerName || "—"}</Item>
            <Item label="الدرجة">
              <ExamScore total={exam.total} maxScore={exam.maxScore} />
              {percent != null && (
                <span className="ms-2 text-muted-foreground" dir="ltr">
                  ({percent}%)
                </span>
              )}
            </Item>
            <Item label="التقدير">{exam.grade || "—"}</Item>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأسئلة</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>السورة</TableHead>
                <TableHead>من آية</TableHead>
                <TableHead>إلى آية</TableHead>
                <TableHead>أخطاء</TableHead>
                <TableHead>تنبيهات</TableHead>
                <TableHead>تجويد</TableHead>
                <TableHead>الدرجة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exam.questions.map((q, i) => (
                <TableRow key={i}>
                  <TableCell className="font-semibold">{q.label}</TableCell>
                  <TableCell>{surahName(q.surah) || "—"}</TableCell>
                  <TableCell>{q.fromAyah}</TableCell>
                  <TableCell>{q.toAyah}</TableCell>
                  <TableCell>{q.mistakes}</TableCell>
                  <TableCell>{q.prompts}</TableCell>
                  <TableCell>{q.tajweedMistakes}</TableCell>
                  <TableCell className="font-medium">{q.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {exam.note && (
        <Card>
          <CardHeader>
            <CardTitle>{exam.type === "FOLLOW_UP" ? "ملاحظات للمعلم" : "ملاحظات"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{exam.note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
