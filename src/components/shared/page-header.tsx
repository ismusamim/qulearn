import type { ReactNode } from "react";

/** Title row at the top of every page, with optional description and action buttons. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Action buttons, shown at the end of the row. */
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
