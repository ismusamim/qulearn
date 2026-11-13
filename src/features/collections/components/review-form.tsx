"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import { reviewCollectionAction } from "../actions";
import type { CollectionDetailDTO } from "../service";
import { LineStateBadge } from "./collection-badges";

type Decisions = Record<string, { ok: boolean; note: string }>;

/**
 * One teacher's list. While it waits for review, each pending
 * line gets a decision — confirm, or return with a note; otherwise it is read-only.
 */
export function ReviewForm({ collection }: { collection: CollectionDetailDTO }) {
  const router = useRouter();
  const open = collection.status === "SENT";
  const pendingLines = collection.lines.filter((l) => l.state === "PENDING");
  const [decisions, setDecisions] = useState<Decisions>(() =>
    Object.fromEntries(pendingLines.map((l) => [l.studentId, { ok: true, note: "" }])),
  );
  const [note, setNote] = useState("");

  const review = useAction(reviewCollectionAction, {
    onSuccess: (result) => {
      toast.success(
        `تم: تأكيد ${result.confirmed}${result.returned ? ` وإرجاع ${result.returned}` : ""}${
          result.status === "DONE" ? " — القائمة مؤكدة بالكامل" : ""
        }`,
      );
      router.push("/collections/review");
    },
  });

  const set = (studentId: string, patch: Partial<Decisions[string]>) =>
    setDecisions((d) => ({ ...d, [studentId]: { ...d[studentId], ...patch } }));

  const submit = () => {
    const list = pendingLines.map((l) => ({
      studentId: l.studentId,
      ok: decisions[l.studentId]?.ok ?? true,
      note: decisions[l.studentId]?.note.trim() ?? "",
    }));
    if (list.some((d) => !d.ok && !d.note)) {
      toast.error("اكتب ملاحظة لكل اسم تعيده للمعلم");
      return;
    }
    review.execute({ collectionId: collection.id, decisions: list, note: note.trim() });
  };

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>الطالب</TableHead>
            <TableHead>المستحق</TableHead>
            <TableHead>المحصَّل</TableHead>
            <TableHead>الفرق</TableHead>
            <TableHead>ملاحظة المعلم</TableHead>
            <TableHead>القرار</TableHead>
            <TableHead>ملاحظة المحاسب</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {collection.lines.map((line, index) => {
            const deciding = open && line.state === "PENDING";
            const decision = decisions[line.studentId];
            return (
              <TableRow key={line.studentId}>
                <TableCell dir="ltr" className="text-end text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="font-medium">{line.name}</TableCell>
                <TableCell dir="ltr" className="text-end">
                  {line.due == null ? "—" : formatMoney(line.due)}
                </TableCell>
                <TableCell dir="ltr" className="text-end">
                  {formatMoney(line.amount)}
                </TableCell>
                <TableCell
                  dir="ltr"
                  className={cn("text-end", line.diff != null && line.diff !== 0 && "font-bold", {
                    "text-destructive": (line.diff ?? 0) < 0,
                    "text-success": (line.diff ?? 0) > 0,
                  })}
                >
                  {line.diff == null ? "—" : formatMoney(line.diff)}
                </TableCell>
                <TableCell className="whitespace-normal">{line.note}</TableCell>
                <TableCell>
                  {deciding ? (
                    <NativeSelect
                      aria-label={`القرار في ${line.name}`}
                      value={decision?.ok === false ? "issue" : "ok"}
                      onChange={(e) => set(line.studentId, { ok: e.target.value === "ok" })}
                    >
                      <NativeSelectOption value="ok">تأكيد</NativeSelectOption>
                      <NativeSelectOption value="issue">إرجاع</NativeSelectOption>
                    </NativeSelect>
                  ) : (
                    <LineStateBadge state={line.state} />
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {deciding ? (
                    <Input
                      className="min-w-48"
                      maxLength={300}
                      placeholder="ملاحظة للمعلم (عند الإرجاع)"
                      aria-label={`ملاحظة للمعلم عن ${line.name}`}
                      aria-invalid={decision?.ok === false && !decision.note.trim()}
                      value={decision?.note ?? ""}
                      onChange={(e) => set(line.studentId, { note: e.target.value })}
                    />
                  ) : (
                    line.accountantNote
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {open ? (
        <>
          <Field>
            <FieldLabel htmlFor="review-note">ملاحظة عامة للمعلم (اختيارية)</FieldLabel>
            <Input id="review-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="no-print flex gap-2">
            <Button onClick={submit} disabled={review.pending || pendingLines.length === 0}>
              {review.pending && <Spinner />}
              تنفيذ القرار
            </Button>
          </div>
        </>
      ) : (
        collection.accountantNote && (
          <Alert>
            <AlertDescription>ملاحظة المحاسب: {collection.accountantNote}</AlertDescription>
          </Alert>
        )
      )}
    </div>
  );
}
