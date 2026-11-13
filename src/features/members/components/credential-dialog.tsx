"use client";

import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CredentialDTO } from "../service";
import { CredentialActions, copyText } from "./credential-actions";

/** Shows one new password — the only time it can be seen — with ways to hand it over. */
export function CredentialDialog({
  credential,
  org,
  onClose,
}: {
  credential: CredentialDTO;
  org: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>كلمة مرور «{credential.name}»</DialogTitle>
          <DialogDescription>
            تظهر هذه الكلمة <b>الآن فقط</b>؛ تُحفظ على الخادم مشفّرة ولا يمكن عرضها بعد إغلاق هذه النافذة. سلّمها
            لصاحبها ليدخل باسمه وكلمة مروره من صفحة الدخول.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <code dir="ltr" className="text-2xl font-bold tracking-widest select-all">
            {credential.password}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => copyText(credential.password, "تم نسخ كلمة المرور")}>
            <CopyIcon />
            نسخ
          </Button>
        </div>
        <CredentialActions credential={credential} org={org} />
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            تم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
