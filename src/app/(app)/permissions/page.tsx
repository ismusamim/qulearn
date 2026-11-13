import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { PermissionsBoard } from "@/features/permissions/components/permissions-board";
import { getPermissionsOverview } from "@/features/permissions/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الصلاحيات" };

export default async function PermissionsPage() {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const overview = await getPermissionsOverview(auth);

  return (
    <>
      <PageHeader
        title="الصلاحيات"
        description="وزّع الصلاحيات على فئة كاملة أو على شخص بعينه. صلاحية الشخص تتقدّم على صلاحية فئته."
      />
      <PermissionsBoard overview={overview} />
    </>
  );
}
