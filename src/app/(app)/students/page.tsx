import type { Metadata } from "next";
import Link from "next/link";

import { PlusIcon, UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StudentsFilters } from "@/features/students/components/students-filters";
import { StudentsTable } from "@/features/students/components/students-table";
import { canOpenStudents, listFeeOptions, listHalaqaChoices, listStudents, studentCaps } from "@/features/students/queries";
import { type StudentFilters, studentFiltersSchema } from "@/features/students/schemas";
import { requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الطلاب" };

function pageHref(filters: StudentFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.halaqaId) params.set("halaqaId", filters.halaqaId);
  if (filters.status) params.set("status", filters.status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/students?${query}` : "/students";
}

export default async function StudentsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const auth = await requirePage(canOpenStudents);
  const filters = studentFiltersSchema.parse(await props.searchParams);
  const caps = studentCaps(auth);
  const [list, halaqat, feeOptions] = await Promise.all([
    listStudents(auth, filters),
    listHalaqaChoices(auth),
    caps.fee ? listFeeOptions(auth) : null,
  ]);
  const filtered = !!(filters.q || filters.category || filters.halaqaId || filters.status);
  const presetHalaqa = filters.halaqaId && filters.halaqaId !== "none" ? `?halaqaId=${filters.halaqaId}` : "";

  return (
    <>
      <PageHeader title="الطلاب" description={`${list.total} طالبًا`}>
        {caps.add && (
          <Button asChild>
            <Link href={`/students/new${presetHalaqa}`}>
              <PlusIcon />
              استمارة طالب
            </Link>
          </Button>
        )}
      </PageHeader>
      <StudentsFilters filters={filters} halaqat={halaqat} />
      {list.rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title={filtered ? "لا توجد نتائج مطابقة." : "لا يوجد طلاب بعد."} />
      ) : (
        <Card>
          <CardContent>
            <StudentsTable
              rows={list.rows}
              offset={(list.page - 1) * list.pageSize}
              caps={caps}
              halaqat={halaqat}
              feeOptions={feeOptions}
            />
            {list.pageCount > 1 && (
              <nav className="no-print mt-4 flex items-center justify-between gap-2 text-sm" aria-label="الصفحات">
                <span className="text-muted-foreground">
                  صفحة <span dir="ltr">{list.page}</span> من <span dir="ltr">{list.pageCount}</span> — اكتب في البحث للتضييق
                </span>
                <span className="flex gap-2">
                  {list.page > 1 && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={pageHref(filters, list.page - 1)}>السابق</Link>
                    </Button>
                  )}
                  {list.page < list.pageCount && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={pageHref(filters, list.page + 1)}>التالي</Link>
                    </Button>
                  )}
                </span>
              </nav>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
