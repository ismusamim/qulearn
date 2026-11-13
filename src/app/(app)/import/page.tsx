import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { BackupPanel } from "@/features/import/components/backup-panel";
import { CustomFieldsTable } from "@/features/import/components/custom-fields-table";
import { ImportTabs, parseImportTab } from "@/features/import/components/import-tabs";
import { MemberImport } from "@/features/import/components/member-import";
import { PendingColumns } from "@/features/import/components/pending-columns";
import { countPendingColumns, listCustomFieldDefs, listPendingColumns } from "@/features/import/pending-service";
import { listFieldTargets } from "@/features/import/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الاستيراد والبيانات" };

export default async function ImportPage(props: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const tab = parseImportTab((await props.searchParams).tab);

  const pendingCount = await countPendingColumns(auth);
  const loadTargets = async () => ({
    STUDENTS: await listFieldTargets(auth, "STUDENTS"),
    TEACHERS: await listFieldTargets(auth, "TEACHERS"),
  });

  return (
    <>
      <PageHeader
        title="الاستيراد والبيانات"
        description="استيراد الطلاب والمعلمين من الجداول، ومراجعة الأعمدة المعلّقة، والحقول الإضافية، والنسخ الاحتياطي."
      />
      <ImportTabs active={tab} pendingCount={pendingCount} />
      {tab === "members" && <MemberImport targets={await loadTargets()} />}
      {tab === "pending" && <PendingColumns columns={await listPendingColumns(auth)} targets={await loadTargets()} />}
      {tab === "fields" && <CustomFieldsTable fields={await listCustomFieldDefs(auth)} />}
      {tab === "backup" && <BackupPanel />}
    </>
  );
}
