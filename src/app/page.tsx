import { redirect } from "next/navigation";

import { homeFor } from "@/lib/navigation";
import { requirePageAuth } from "@/server/auth";

/** "/" has no content of its own: everyone is sent to their first section. */
export default async function RootPage() {
  const auth = await requirePageAuth();
  redirect(homeFor(auth.role, auth.permissions));
}
