import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { NewsCard, RecentRecitationsCard, UnassignedStudentsCard } from "@/features/dashboard/components/activity-cards";
import { AttendanceCard } from "@/features/dashboard/components/attendance-card";
import { QuickLinks } from "@/features/dashboard/components/quick-links";
import { StatCards } from "@/features/dashboard/components/stat-cards";
import { getDashboard } from "@/features/dashboard/service";
import { monthName, weekdayName } from "@/lib/dates";
import { navFor } from "@/lib/navigation";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الرئيسية" };

export default async function DashboardPage() {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const data = await getDashboard(auth);
  const [year, month, day] = data.today.split("-").map(Number);
  const links = navFor(auth.role, auth.permissions).filter((item) => item.href !== "/dashboard");

  return (
    <>
      <PageHeader
        title="الرئيسية"
        description={`أهلًا ${auth.name} — ${weekdayName(data.today)} ${day} ${monthName(month)} ${year}`}
      />
      <div className="flex flex-col gap-6">
        <StatCards data={data} />
        <div className="grid gap-6 lg:grid-cols-2">
          <AttendanceCard attendance={data.attendance} />
          <UnassignedStudentsCard unassigned={data.unassigned} />
          <RecentRecitationsCard items={data.recentRecitations} weekCount={data.weekRecitations} />
          <NewsCard news={data.news} />
        </div>
        <QuickLinks items={links} />
      </div>
    </>
  );
}
