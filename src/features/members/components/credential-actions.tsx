"use client";

import { CopyIcon, MessageCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { loginMessage, whatsappLink } from "../domain";
import type { CredentialDTO } from "../service";

export async function copyText(text: string, doneMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(doneMessage);
  } catch {
    toast.error("تعذّر النسخ، انسخ النص يدويًا");
  }
}

/** «واتساب» and «نسخ الرسالة» for one freshly generated password. */
export function CredentialActions({
  credential,
  org,
  onSent,
}: {
  credential: CredentialDTO;
  org: string;
  /** Called once the admin used either way of handing the message over. */
  onSent?: () => void;
}) {
  // Built on click: the site address is only known in the browser.
  const message = () =>
    loginMessage({ org, url: window.location.origin, name: credential.name, password: credential.password });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          window.open(whatsappLink(credential.whatsapp, message()), "_blank", "noopener,noreferrer");
          onSent?.();
        }}
      >
        <MessageCircleIcon />
        {credential.whatsapp ? "واتساب" : "واتساب (اختر جهة)"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          await copyText(message(), `نُسخت رسالة «${credential.name}»`);
          onSent?.();
        }}
      >
        <CopyIcon />
        نسخ الرسالة
      </Button>
    </div>
  );
}
