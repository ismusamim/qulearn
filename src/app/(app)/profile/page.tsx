import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { MyProfile } from "@/features/teachers/components/my-profile";
import { getMyFile } from "@/features/teachers/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "ملفي" };

export default async function ProfilePage() {
  const auth = await requirePage((a) => hasRole(a, "TEACHER"));
  const { teacher, customFields } = await getMyFile(auth);

  return (
    <>
      <PageHeader title="ملفي" description={`ملف المعلم الداخلي: ${teacher.name}`} />
      <MyProfile teacher={teacher} customFields={customFields} />
    </>
  );
}
