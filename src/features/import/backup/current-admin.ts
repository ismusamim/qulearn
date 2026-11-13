import { normalizeArabic } from "@/lib/arabic";

import type { BackupData } from "./format";

type BackupMember = BackupData["members"][number];

const UUID_GLOBAL = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Rewrites ids everywhere in a data set (primary keys and references alike).
 * Ids are UUIDs, which cannot occur by accident inside other text, so a single
 * pass over the serialised document is both safe and fast.
 */
export function remapIds<T>(value: T, map: ReadonlyMap<string, string>): T {
  if (!map.size) return value;
  return JSON.parse(JSON.stringify(value).replace(UUID_GLOBAL, (id) => map.get(id.toLowerCase()) ?? id)) as T;
}

/**
 * «استبدال الكل» must not lock out the admin performing it. Their account is
 * always present afterwards under its current id and password:
 *   - the backup has that id            → its row is used, with the current password;
 *   - the backup has an admin of the same name → that account becomes the current one
 *     (its id is rewritten everywhere);
 *   - otherwise the current account is added.
 */
export function keepCurrentAdmin(data: BackupData, me: BackupMember): BackupData {
  const same = data.members.find((m) => m.id === me.id);
  if (same) {
    return { ...data, members: data.members.map((m) => (m.id === me.id ? { ...m, role: me.role, passwordHash: me.passwordHash } : m)) };
  }
  const key = normalizeArabic(me.name);
  const twin = data.members.find((m) => m.role === me.role && normalizeArabic(m.name) === key);
  if (twin) {
    const remapped = remapIds(data, new Map([[twin.id, me.id]]));
    return { ...remapped, members: remapped.members.map((m) => (m.id === me.id ? { ...m, passwordHash: me.passwordHash } : m)) };
  }
  return { ...data, members: [...data.members, me] };
}
