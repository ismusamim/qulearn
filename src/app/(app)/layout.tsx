import { AppSidebar } from "@/components/layout/app-sidebar";
import { BlockedNotice } from "@/components/layout/blocked-notice";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { listSwitchTargets } from "@/features/auth/service";
import { navFor } from "@/lib/navigation";
import { requirePageAuth } from "@/server/auth";
import { getBranding, getSettings } from "@/server/settings";

/** Shell for every signed-in page: sidebar on the right, content beside it. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requirePageAuth();
  const [{ org, logo }, switchTargets] = await Promise.all([getBranding(), listSwitchTargets(auth)]);

  let content = children;
  if (auth.blocked) {
    const { blockMessages } = await getSettings();
    content = <BlockedNotice message={auth.role === "STUDENT" ? blockMessages.student : blockMessages.teacher} />;
  }

  return (
    <SidebarProvider>
      <AppSidebar
        org={org}
        logo={logo}
        user={{ name: auth.name, role: auth.role }}
        items={auth.blocked ? [] : navFor(auth.role, auth.permissions)}
        switchTargets={switchTargets}
      />
      <SidebarInset>
        <header className="no-print sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
          <span className="truncate text-sm font-semibold">{org}</span>
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{content}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
