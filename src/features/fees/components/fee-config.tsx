"use client";

import { PencilIcon, PercentIcon, PlusIcon, TagsIcon, Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { CURRENCY_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

import { deleteCategoryAction, deleteDiscountAction } from "../actions";
import type { FeeConfigDTO } from "../config-service";
import { discountText } from "../summary";
import { CategoryFormDialog } from "./category-form-dialog";
import { DiscountFormDialog } from "./discount-form-dialog";

const DEFAULT_FOR_LABELS = { CHILD: "الصغار", ADULT: "الكبار" } as const;

const usedBy = (count: number, fallback: string) => (count > 0 ? `مستخدم لـ${count} طالب. ${fallback}` : "لا يمكن التراجع عن الحذف.");

/** «الفئات والخصومات» — admin only. */
export function FeeConfig({ config }: { config: FeeConfigDTO }) {
  const removeCategory = useAction(deleteCategoryAction, { successMessage: "تم حذف الفئة" });
  const removeDiscount = useAction(deleteDiscountAction, { successMessage: "تم حذف الخصم" });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>فئات الاشتراك (المبلغ الشهري)</CardTitle>
          <CardDescription>
            «الافتراضية لـ» تجعل الفئة تُطبَّق تلقائيًا على كل الصغار أو كل الكبار ما لم تُعيَّن لهم فئة أخرى.
          </CardDescription>
          <CardAction>
            <CategoryFormDialog>
              <Button size="sm">
                <PlusIcon />
                فئة
              </Button>
            </CategoryFormDialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          {config.categories.length === 0 ? (
            <EmptyState icon={TagsIcon} title="لا توجد فئات بعد." description="ابدأ بإضافة فئة للصغار وفئة للكبار." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الفئة</TableHead>
                  <TableHead>المبلغ ({CURRENCY_LABEL})</TableHead>
                  <TableHead>الافتراضية لـ</TableHead>
                  <TableHead>الطلاب</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell dir="ltr" className="text-end">
                      {formatMoney(category.amount)}
                    </TableCell>
                    <TableCell>
                      {category.defaultFor ? <Badge variant="secondary">{DEFAULT_FOR_LABELS[category.defaultFor]}</Badge> : "—"}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end">
                      {category.studentCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <CategoryFormDialog category={category}>
                          <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${category.name}`}>
                            <PencilIcon />
                          </Button>
                        </CategoryFormDialog>
                        <ConfirmDialog
                          title={`حذف فئة «${category.name}»؟`}
                          description={usedBy(category.studentCount, "سيعودون إلى الفئة الافتراضية لسنّهم.")}
                          confirmLabel="حذف"
                          destructive
                          onConfirm={() => removeCategory.execute({ id: category.id })}
                        >
                          <Button variant="ghost" size="icon-sm" aria-label={`حذف ${category.name}`} disabled={removeCategory.pending}>
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

      <Card>
        <CardHeader>
          <CardTitle>الخصومات</CardTitle>
          <CardDescription>
            «لكل طالب»: لا قيمة عامة للخصم، وتُحدَّد قيمته ونوعه لكل طالب (مثل الحالات الخاصة). خصم 100% يجعل الطالب معفى.
          </CardDescription>
          <CardAction>
            <DiscountFormDialog>
              <Button size="sm">
                <PlusIcon />
                خصم
              </Button>
            </DiscountFormDialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          {config.discounts.length === 0 ? (
            <EmptyState icon={PercentIcon} title="لا توجد خصومات." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الخصم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>القيمة</TableHead>
                  <TableHead>الطلاب</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.discounts.map((discount) => (
                  <TableRow key={discount.id}>
                    <TableCell className="font-medium">{discount.name}</TableCell>
                    <TableCell>{discount.type === "AMOUNT" ? `مبلغ ثابت (${CURRENCY_LABEL})` : "نسبة %"}</TableCell>
                    <TableCell>
                      {discount.perStudent ? (
                        <Badge variant="outline">لكل طالب</Badge>
                      ) : (
                        <span dir="ltr">{discountText(discount.type, discount.value, formatMoney, CURRENCY_LABEL)}</span>
                      )}
                    </TableCell>
                    <TableCell dir="ltr" className="text-end">
                      {discount.studentCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <DiscountFormDialog discount={discount}>
                          <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${discount.name}`}>
                            <PencilIcon />
                          </Button>
                        </DiscountFormDialog>
                        <ConfirmDialog
                          title={`حذف خصم «${discount.name}»؟`}
                          description={usedBy(discount.studentCount, "سيصبحون بلا خصم.")}
                          confirmLabel="حذف"
                          destructive
                          onConfirm={() => removeDiscount.execute({ id: discount.id })}
                        >
                          <Button variant="ghost" size="icon-sm" aria-label={`حذف ${discount.name}`} disabled={removeDiscount.pending}>
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
    </div>
  );
}
