import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { MembersView } from "@/features/members/components/members-view";
import { roleFromSlug } from "@/features/members/domain";
import { listMembers } from "@/features/members/service";
import { hasRole, requirePage } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "الأعضاء" };

export default async function MembersPage(props: { searchParams: Promise<{ role?: string | string[] }> }) {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const { role: slug } = await props.searchParams;
  const role = roleFromSlug(Array.isArray(slug) ? slug[0] : slug);
  const [list, settings] = await Promise.all([listMembers(auth, role), getSettings()]);

  return (
    <>
      <PageHeader title="الأعضاء" description="حسابات الدخول: لكل عضو اسمه وكلمة مرور تُنشأ تلقائيًا." />
      <MembersView key={role} list={list} org={settings.org} />
    </>
  );
}
