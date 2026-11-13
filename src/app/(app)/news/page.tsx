import type { Metadata } from "next";

import { PlusIcon } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NewsList } from "@/features/news/components/news-list";
import { PublishNewsDialog } from "@/features/news/components/publish-news-dialog";
import { listNews } from "@/features/news/service";
import { hasRole, requirePageAuth } from "@/server/auth";

export const metadata: Metadata = { title: "الإعلانات" };

export default async function NewsPage() {
  const auth = await requirePageAuth();
  const items = await listNews(auth);
  const isAdmin = hasRole(auth, "ADMIN");

  return (
    <>
      <PageHeader
        title="الإعلانات"
        description={isAdmin ? "إعلانات الإدارة، والملاحظات المرسلة إليها موقّعة بأسماء أصحابها." : undefined}
      >
        {isAdmin && (
          <PublishNewsDialog>
            <Button>
              <PlusIcon />
              إعلان
            </Button>
          </PublishNewsDialog>
        )}
      </PageHeader>
      <NewsList items={items} showAudience={isAdmin} />
    </>
  );
}
