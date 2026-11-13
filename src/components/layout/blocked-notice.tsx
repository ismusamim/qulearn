import { BanIcon } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Shown instead of the app to dropped students and suspended teachers. */
export function BlockedNotice({ message }: { message: string }) {
  return (
    <Empty className="min-h-[60svh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BanIcon />
        </EmptyMedia>
        <EmptyTitle>الحساب موقوف</EmptyTitle>
        <EmptyDescription className="whitespace-pre-line">{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
