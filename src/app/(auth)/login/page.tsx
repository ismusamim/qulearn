import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { homeFor } from "@/lib/navigation";
import { getAuth } from "@/server/auth";
import { getBranding } from "@/server/settings";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  const auth = await getAuth();
  if (auth) redirect(homeFor(auth.role, auth.permissions));
  const { org, logo } = await getBranding();

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          {/* The logo may be a data URL uploaded from Settings, so it is not optimised. */}
          <Image src={logo} alt="" width={96} height={96} unoptimized priority className="mx-auto size-24 object-contain" />
          <CardTitle className="text-xl">{org}</CardTitle>
          <CardDescription>سجّل الدخول باسمك وكلمة المرور</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
