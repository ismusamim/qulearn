import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CURRENCY_LABEL, STUDENT_CATEGORY_LABELS, STUDENT_STATUS_LABELS } from "@/lib/constants";
import { formatMoney, initialOf } from "@/lib/format";

import type { StudentDTO } from "../queries";

/** A label/value line; nothing is printed for an empty value, like a paper form left blank. */
function Line({ label, value, ltr }: { label: string; value: ReactNode; ltr?: boolean }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <tr className="border-b last:border-b-0">
      <th scope="row" className="w-2/5 bg-muted/50 px-3 py-2 text-start font-medium">
        {label}
      </th>
      <td className="px-3 py-2" dir={ltr ? "ltr" : undefined} style={ltr ? { textAlign: "end" } : undefined}>
        {value}
      </td>
    </tr>
  );
}

function PhoneLine({ label, phone, whatsapp }: { label: string; phone: string; whatsapp: string }) {
  if (!phone && !whatsapp) return null;
  return (
    <Line
      label={label}
      value={
        <>
          <span dir="ltr">{phone || "—"}</span>
          {whatsapp && whatsapp !== phone && (
            <>
              {" — واتساب "}
              {/* Egyptian numbers: wa.me wants the country code, stored numbers start with 0. */}
              <a href={`https://wa.me/2${whatsapp}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-primary underline">
                {whatsapp}
              </a>
            </>
          )}
        </>
      }
    />
  );
}

/** A titled table; omitted entirely when none of its lines has a value. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid has-[tbody:empty]:hidden">
      <h2 className="mb-2 border-s-4 border-gold ps-2 text-base font-bold text-primary">{title}</h2>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

/** ملف الطالب: the application form, read-only, laid out like the paper form for printing. */
export function StudentFile({ student: s }: { student: StudentDTO }) {
  const child = s.category === "CHILD";
  const relation = s.guardianRelation === "شخص آخر" ? s.guardianRelationOther || "شخص آخر" : s.guardianRelation;
  const extras = s.customFields.filter((f) => s.extra[f.key]);
  const due = s.feeDue;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <header className="flex items-center gap-4">
          <Avatar className="size-24 rounded-xl after:rounded-xl">
            {s.photo && <AvatarImage src={s.photo} alt="" className="rounded-xl" />}
            <AvatarFallback className="rounded-xl text-3xl">{initialOf(s.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xl font-bold">{s.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={child ? "secondary" : "outline"}>{STUDENT_CATEGORY_LABELS[s.category]}</Badge>
              {s.age != null && <span>{s.age} سنة</span>}
              {s.status === "DROPPED" ? (
                <>
                  <Badge variant="destructive">{STUDENT_STATUS_LABELS.DROPPED}</Badge>
                  {s.statusDate && <span dir="ltr">{s.statusDate}</span>}
                </>
              ) : (
                <Badge className="bg-success/15 text-success">{STUDENT_STATUS_LABELS.ACTIVE}</Badge>
              )}
            </p>
          </div>
        </header>

        {child ? (
          <Section title="خاص بالطالب">
            <Line label="الرقم القومي" value={s.nationalId} ltr />
            <Line label="تاريخ الميلاد" value={s.birthDate} ltr />
            <Line label="الدراسة" value={s.study} />
            <Line label="الصف الدراسي" value={s.grade} />
          </Section>
        ) : (
          <Section title="بيانات">
            <Line label="الرقم القومي" value={s.nationalId} ltr />
            <Line label="المؤهل الدراسي" value={[s.qualification, s.qualificationStatus].filter(Boolean).join(" — ")} />
            <Line label="الحالة الاجتماعية" value={s.maritalStatus} />
            <Line label="الوظيفة الحالية" value={s.job} />
            <Line label="الوقت المتاح للحضور" value={s.availability} />
          </Section>
        )}

        <Section title="العنوان والتواصل">
          <Line label="العنوان" value={s.address} />
          <PhoneLine label="رقم الهاتف" phone={s.phone} whatsapp={s.whatsapp} />
        </Section>

        {child && (
          <Section title="خاص بولي الأمر">
            <Line label="اسم ولي الأمر" value={s.guardianName} />
            <PhoneLine label="رقم الهاتف" phone={s.guardianPhone} whatsapp={s.guardianWhatsapp} />
            <Line label="الوظيفة" value={s.guardianJob} />
            <Line label="صلة القرابة" value={relation} />
          </Section>
        )}

        <Section title="اختبار تحديد مستوى">
          <Line label="قراءة" value={s.testReading} />
          <Line label="تجويد" value={s.testTajweed} />
          <Line label="حفظ" value={s.testHifz} />
        </Section>

        <Section title="قرار المسؤول">
          <Line label="ينضم لحلقة" value={s.halaqaLabel} />
          <Line label="في" value={s.placeName} />
          <Line label="وقت الحلقة" value={s.schedule} />
          <Line label="تحرر يوم" value={s.joinDate} ltr />
          <Line label="الاشتراك الشهري" value={s.monthlyFee == null ? "" : `${formatMoney(s.monthlyFee)} ${CURRENCY_LABEL}`} />
          {due && (
            <>
              <Line label="فئة الاشتراك" value={due.source === "own" ? "" : due.categoryName} />
              <Line label="الخصم" value={due.discountName ? `${due.discountName} (${formatMoney(due.discount)} ${CURRENCY_LABEL})` : ""} />
              <Line label="المستحق شهريًا" value={due.due == null ? "" : `${formatMoney(due.due)} ${CURRENCY_LABEL}`} />
            </>
          )}
          <Line label="التوقيع على التنبيهات" value={s.pledgeSigned ? (child ? "وقّع ولي الأمر" : "وقّع المتقدم") : "لم يوقّع بعد"} />
        </Section>

        <Section title="بيانات إضافية">
          {extras.map((f) => (
            <Line key={f.key} label={f.label} value={<span className="whitespace-pre-wrap">{s.extra[f.key]}</span>} />
          ))}
        </Section>
      </CardContent>
    </Card>
  );
}
