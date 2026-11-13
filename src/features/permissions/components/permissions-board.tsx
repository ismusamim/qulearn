"use client";

import { useState } from "react";

import type { PermissionsOverview } from "../service";
import { GrantDialog, type GrantTarget } from "./grant-dialog";
import { MemberOverrides } from "./member-overrides";
import { PermissionsMatrix } from "./permissions-matrix";

/** The permissions screen: the role matrix, the personal overrides, and the dialog both open. */
export function PermissionsBoard({ overview }: { overview: PermissionsOverview }) {
  const [dialog, setDialog] = useState<{ open: boolean; target: GrantTarget }>({
    open: false,
    target: { kind: "role", role: "TEACHER" },
  });
  const openOn = (target: GrantTarget) => setDialog({ open: true, target });

  return (
    <div className="flex flex-col gap-6">
      <PermissionsMatrix
        // Remount on new server data so optimistic switch positions never outlive it.
        key={JSON.stringify(overview.roleSettings)}
        roleSettings={overview.roleSettings}
        onAdd={() => openOn({ kind: "role", role: "TEACHER" })}
      />
      <MemberOverrides
        overrides={overview.overrides}
        onAdd={() => openOn({ kind: "person", memberId: null })}
        onEdit={(memberId) => openOn({ kind: "person", memberId })}
      />
      <GrantDialog
        overview={overview}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        initial={dialog.target}
      />
    </div>
  );
}
