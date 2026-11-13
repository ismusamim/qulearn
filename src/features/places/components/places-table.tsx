"use client";

import { MapPinIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { PLACE_TYPE_LABELS } from "@/lib/constants";

import { deletePlaceAction } from "../actions";
import type { PlaceDTO } from "../service";
import { PlaceFormDialog } from "./place-form-dialog";

export function PlacesTable({ places }: { places: PlaceDTO[] }) {
  const remove = useAction(deletePlaceAction, { successMessage: "تم حذف المكان" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الأماكن</CardTitle>
        <CardAction>
          <PlaceFormDialog>
            <Button size="sm">
              <PlusIcon />
              مكان جديد
            </Button>
          </PlaceFormDialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        {places.length === 0 ? (
          <EmptyState icon={MapPinIcon} title="لا توجد أماكن بعد" description="أضف مسجدًا أو دار تحفيظ لتُنشئ فيه الحلقات." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المكان</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الحلقات</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {places.map((place) => (
                <TableRow key={place.id}>
                  <TableCell className="font-medium">{place.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{PLACE_TYPE_LABELS[place.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{place.address || "—"}</TableCell>
                  <TableCell>{place.halaqaCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <PlaceFormDialog place={place}>
                        <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${place.name}`}>
                          <PencilIcon />
                        </Button>
                      </PlaceFormDialog>
                      <ConfirmDialog
                        title={`حذف «${place.name}»؟`}
                        description={
                          place.halaqaCount > 0
                            ? `فيه ${place.halaqaCount} حلقة؛ ستبقى الحلقات بلا مكان.`
                            : "لا يمكن التراجع عن الحذف."
                        }
                        confirmLabel="حذف"
                        destructive
                        onConfirm={() => remove.execute({ id: place.id })}
                      >
                        <Button variant="ghost" size="icon-sm" aria-label={`حذف ${place.name}`} disabled={remove.pending}>
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
