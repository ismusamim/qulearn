import type { Role } from "@/lib/constants";

import type { NewsAudience } from "./schemas";

interface Reader {
  memberId: string;
  role: Role;
}

interface NewsLike {
  audience: NewsAudience;
  authorId: string | null;
}

/**
 * Who may read an item: it is for everyone, or for the reader's role, or the
 * reader is an admin, or the reader wrote it (so the sender of a note to the
 * administration still sees it).
 */
export function canReadNews(reader: Reader, item: NewsLike): boolean {
  return (
    item.audience === "ALL" ||
    reader.role === "ADMIN" ||
    item.audience === reader.role ||
    (item.authorId !== null && item.authorId === reader.memberId)
  );
}

/** Admins delete anything; anyone else only what they wrote themselves. */
export function canDeleteNews(reader: Reader, item: NewsLike): boolean {
  return reader.role === "ADMIN" || (item.authorId !== null && item.authorId === reader.memberId);
}

const NOTE_ROLE_TITLES: Record<Role, string> = {
  ACCOUNTANT: "المحاسب",
  TEACHER: "المعلم",
  SUPERVISOR: "المشرف",
  ADMIN: "المدير",
  STUDENT: "الطالب",
};

/** Signature shown on a note: role title + name, e.g. «المحاسب فلان». */
export function noteAuthorLabel(role: Role, name: string): string {
  return `${NOTE_ROLE_TITLES[role]} ${name}`.trim();
}
