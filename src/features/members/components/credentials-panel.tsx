"use client";

import { useState } from "react";

import { CheckIcon, CopyIcon } from "lucide-react";

import { PrintButton } from "@/components/shared/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { CredentialDTO } from "../service";
import { CredentialActions, copyText } from "./credential-actions";

/**
 * Result of a bulk reset: every member with their new password, printable and
 * copyable. It lives only in this component's state — closing it loses the
 * passwords for good, hence the warning when some were not handed over yet.
 */
export function CredentialsPanel({
  credentials,
  org,
  onClose,
}: {
  credentials: CredentialDTO[];
  org: string;
  onClose: () => void;
}) {
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  // The whole list was copied or printed, so nothing is lost by closing.
  const [taken, setTaken] = useState(false);
  const [warned, setWarned] = useState(false);
  const left = credentials.filter((c) => !sent.has(c.id)).length;

  const markSent = (id: string) => setSent((prev) => new Set(prev).add(id));
  const copyAll = () => {
    void copyText(credentials.map((c) => `${c.name}\t${c.password}`).join("\n"), "تم نسخ القائمة");
    setTaken(true);
  };
  const close = () => {
    if (left > 0 && !taken && !warned) setWarned(true);
    else onClose();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>بيانات الدخول ({credentials.length})</CardTitle>
        <CardDescription className="no-print">
          تظهر هذه الكلمات <b>الآن فقط</b> ولا تُحفظ. أرسل لكل شخص رسالته <b>على انفراد</b> بزر «واتساب» أو «نسخ
          الرسالة»، ولا تنشر القائمة في مجموعة.
        </CardDescription>
        <CardAction className="no-print flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={copyAll}>
            <CopyIcon />
            نسخ القائمة
          </Button>
          <span onClick={() => setTaken(true)}>
            <PrintButton />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0">#</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead>كلمة المرور</TableHead>
              <TableHead className="no-print">إرسال</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.map((credential, index) => (
              <TableRow key={credential.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-medium">{credential.name}</TableCell>
                <TableCell>
                  <code dir="ltr" className="font-bold tracking-wider select-all">
                    {credential.password}
                  </code>
                </TableCell>
                <TableCell className="no-print">
                  <div className="flex flex-wrap items-center gap-2">
                    <CredentialActions credential={credential} org={org} onSent={() => markSent(credential.id)} />
                    {sent.has(credential.id) && (
                      <Badge variant="secondary" className="text-success">
                        <CheckIcon />
                        أُرسلت
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="no-print flex flex-wrap items-center gap-3">
          <Button type="button" onClick={close}>
            إغلاق
          </Button>
          {warned && !taken && left > 0 && (
            <span className="text-sm text-warning">
              لم تُرسل لـ {left} بعد — الإغلاق يُخفي الكلمات نهائيًا. اضغط «إغلاق» للتأكيد.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
