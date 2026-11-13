import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { TeachersTable } from "@/features/teachers/components/teachers-table";
import { listTeachers } from "@/features/teachers/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "المعلمون" };

export default async function TeachersPage() {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const teachers = await listTeachers(auth);

  return (
    <>
      <PageHeader
        title="المعلمون"
        description="ملف كل معلم (بيانات شخصية وإدارية وفنية) وحالة عمله. المعلم لا يُحذف من هنا، بل يُوقَف ويُعاد."
      />
      <TeachersTable teachers={teachers} />
    </>
  );
}
