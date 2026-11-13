import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewsList } from "@/features/news/components/news-list";
import { NoteForm } from "@/features/news/components/note-form";
import { listSentNotes } from "@/features/news/service";
import { noteAuthorLabel } from "@/features/news/visibility";
import { can, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "ملاحظات للإدارة" };

export default async function NotesPage() {
  const auth = await requirePage((a) => can(a, "notes.send"));
  const notes = await listSentNotes(auth);

  return (
    <>
      <PageHeader title="ملاحظات للإدارة" description="أرسل ملاحظة بخصوص العمل إلى المدير أو المشرفين." />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ملاحظة جديدة</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm signature={noteAuthorLabel(auth.role, auth.name)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>ملاحظاتي المرسلة</CardTitle>
          </CardHeader>
          <CardContent>
            <NewsList items={notes} sent emptyTitle="لم ترسل ملاحظات بعد." />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
