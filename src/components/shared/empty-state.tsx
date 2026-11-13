import type { ReactNode } from "react";

import { InboxIcon, type LucideIcon } from "lucide-react";

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Placeholder for a list or table with nothing in it yet. */
export function EmptyState({
  title,
  description,
  icon: Icon = InboxIcon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Optional call-to-action button. */
  children?: ReactNode;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
