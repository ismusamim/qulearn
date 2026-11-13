import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { AppearanceCard } from "@/features/settings/components/appearance-card";
import { BlockMessagesForm } from "@/features/settings/components/block-messages-form";
import { GeneralSettings } from "@/features/settings/components/general-settings";
import { getSettingsForAdmin } from "@/features/settings/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const settings = await getSettingsForAdmin(auth);

  return (
    <>
      <PageHeader title="الإعدادات" description="اسم المؤسسة ومظهر التطبيق ورسائل الحسابات الموقوفة." />
      <div className="flex flex-col gap-6">
        <AppearanceCard logo={settings.logo} theme={settings.theme} />
        <GeneralSettings org={settings.org} publicNameSearch={settings.publicNameSearch} />
        <BlockMessagesForm messages={settings.blockMessages} />
      </div>
    </>
  );
}
