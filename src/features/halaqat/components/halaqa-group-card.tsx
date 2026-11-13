"use client";

import { HomeIcon, LandmarkIcon, type LucideIcon, PencilIcon, PlusIcon, Trash2Icon, UsersRoundIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { PLACE_TYPE_LABELS } from "@/lib/constants";

import { deleteHalaqaAction } from "../actions";
import type { HalaqaDTO, HalaqaFormOptions } from "../service";
import { HalaqaFormDialog, type PlaceChoice } from "./halaqa-form-dialog";

const PLACE_ICONS: Record<PlaceChoice["type"], LucideIcon> = { MOSQUE: LandmarkIcon, DAR: HomeIcon };

/** One place (or the «no place» bucket) with the halaqat held there. */
export function HalaqaGroupCard({
  place,
  halaqat,
  places,
  options,
  openingId,
  onOpenStudents,
}: {
  /** null = halaqat whose place was deleted or never set. */
  place: (PlaceChoice & { address: string }) | null;
  halaqat: HalaqaDTO[];
  places: PlaceChoice[];
  options: HalaqaFormOptions;
  /** The halaqa whose students list is currently loading. */
  openingId: string | null;
  onOpenStudents: (id: string) => void;
}) {
  const remove = useAction(deleteHalaqaAction, { successMessage: "تم حذف الحلقة" });
  const Icon = place ? PLACE_ICONS[place.type] : UsersRoundIcon;
  const studentCount = halaqat.reduce((sum, h) => sum + h.studentCount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Icon className="size-4 text-gold" />
          {place ? place.name : "حلقات لم يُحدَّد مكانها"}
          {place && <Badge variant="secondary">{PLACE_TYPE_LABELS[place.type]}</Badge>}
        </CardTitle>
        <CardDescription>
          {halaqat.length} حلقة · {studentCount} طالب
          {place?.address ? ` · ${place.address}` : ""}
        </CardDescription>
        {place && (
          <CardAction>
            <HalaqaFormDialog presetPlaceId={place.id} places={places} options={options}>
              <Button size="sm" variant="outline">
                <PlusIcon />
                حلقة هنا
              </Button>
            </HalaqaFormDialog>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {halaqat.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">لا توجد حلقات في هذا المكان بعد.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الحلقة</TableHead>
                <TableHead>المعلم</TableHead>
                <TableHead>المشرف</TableHead>
                <TableHead>الوقت</TableHead>
                <TableHead>الطلاب</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {halaqat.map((halaqa) => (
                <TableRow key={halaqa.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="link"
                        className="h-auto p-0 font-semibold"
                        title="عرض طلاب الحلقة"
                        onClick={() => onOpenStudents(halaqa.id)}
                      >
                        {halaqa.label}
                      </Button>
                      {openingId === halaqa.id && <Spinner />}
                      {!halaqa.teacherId && <Badge variant="outline">بلا معلم</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{halaqa.teacherName ?? "—"}</TableCell>
                  <TableCell>{halaqa.supervisorName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{halaqa.schedule || "—"}</TableCell>
                  <TableCell dir="ltr" className="text-start">
                    {halaqa.studentCount}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <HalaqaFormDialog halaqa={halaqa} places={places} options={options}>
                        <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${halaqa.label}`}>
                          <PencilIcon />
                        </Button>
                      </HalaqaFormDialog>
                      <ConfirmDialog
                        title={`حذف «${halaqa.label}»؟`}
                        description={
                          halaqa.studentCount > 0
                            ? `فيها ${halaqa.studentCount} طالب؛ سيبقون بدون حلقة حتى تنقلهم.`
                            : "لا يوجد فيها طلاب. لا يمكن التراجع عن الحذف."
                        }
                        confirmLabel="حذف"
                        destructive
                        onConfirm={() => remove.execute({ id: halaqa.id })}
                      >
                        <Button variant="ghost" size="icon-sm" aria-label={`حذف ${halaqa.label}`} disabled={remove.pending}>
                          <Trash2Icon className="text-destructive" />
                        </Button>
                      </ConfirmDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
