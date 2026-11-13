"use client";

import { useState, useTransition } from "react";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { ArrowLeftRightIcon, CircleIcon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { logoutAction, switchAccountAction } from "@/features/auth/actions";
import { type Role, ROLE_LABELS } from "@/lib/constants";
import type { ResolvedNavItem } from "@/lib/navigation";

import { NAV_ICONS } from "./nav-icons";

interface AppSidebarProps {
  org: string;
  logo: string;
  user: { name: string; role: Role };
  items: ResolvedNavItem[];
  /** The same person's other accounts (e.g. teacher who is also a student). */
  switchTargets: { memberId: string; role: Role }[];
}

export function AppSidebar({ org, logo, user, items, switchTargets }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const [switchTo, setSwitchTo] = useState<{ memberId: string; role: Role } | null>(null);

  // The longest matching href wins, so /collections/review does not also light up /collections.
  const active = items
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <Sidebar side="right" collapsible="icon" className="no-print">
      <SidebarHeader>
        <div className="flex items-center gap-2 overflow-hidden px-1 py-1.5">
          <Image src={logo} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 rounded-md bg-white object-contain p-0.5" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-bold">{org}</div>
            <div className="truncate text-xs opacity-75">
              {user.name} · {ROLE_LABELS[user.role]}
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = NAV_ICONS[item.icon] ?? CircleIcon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={item.href === active} tooltip={item.label}>
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {switchTargets.map((target) => (
            <SidebarMenuItem key={target.memberId}>
              <SidebarMenuButton tooltip={`الدخول بصفة ${ROLE_LABELS[target.role]}`} onClick={() => setSwitchTo(target)}>
                <ArrowLeftRightIcon />
                <span>الدخول بصفة {ROLE_LABELS[target.role]}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <form action={logoutAction}>
              <SidebarMenuButton type="submit" tooltip="خروج">
                <LogOutIcon />
                <span>خروج</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />

      <SwitchAccountDialog target={switchTo} onClose={() => setSwitchTo(null)} />
    </Sidebar>
  );
}

function SwitchAccountDialog({
  target,
  onClose,
}: {
  target: { memberId: string; role: Role } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    startTransition(async () => {
      const result = await switchAccountAction({ memberId: target.memberId, password });
      setPassword("");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onClose();
      router.replace(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>الدخول بصفة {target ? ROLE_LABELS[target.role] : ""}</DialogTitle>
            <DialogDescription>اكتب كلمة مرور هذا الحساب للتبديل إليه.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="switch-password">كلمة المرور</FieldLabel>
            <Input
              id="switch-password"
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending || !password}>
              {pending && <Spinner />}
              تبديل
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
