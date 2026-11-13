import "server-only";

import type { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { fromISODate, toISODate, todayISO } from "@/lib/dates";
import { type AuthContext, assertCan, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";

import type { NewsAudience, publishNewsSchema, sendNoteSchema } from "./schemas";
import { canDeleteNews, noteAuthorLabel } from "./visibility";

export interface NewsDTO {
  id: string;
  text: string;
  audience: NewsAudience;
  /** ISO date. */
  date: string;
  /** Present on notes sent to the administration: «المحاسب فلان». */
  authorLabel: string | null;
  canDelete: boolean;
}

/** Same rule as `canReadNews`, expressed as a database filter. */
function readableWhere(auth: AuthContext): Prisma.NewsWhereInput {
  if (auth.role === "ADMIN") return {};
  return { OR: [{ audience: "ALL" }, { audience: auth.role }, { authorId: auth.memberId }] };
}

type Row = { id: string; text: string; audience: NewsAudience; date: Date; authorId: string | null; authorLabel: string | null };

function toDTO(auth: AuthContext, row: Row): NewsDTO {
  return {
    id: row.id,
    text: row.text,
    audience: row.audience,
    date: toISODate(row.date),
    authorLabel: row.authorLabel,
    canDelete: canDeleteNews(auth, row),
  };
}

const select = { id: true, text: true, audience: true, date: true, authorId: true, authorLabel: true } as const;

/** Everything the reader may see, newest first. */
export async function listNews(auth: AuthContext): Promise<NewsDTO[]> {
  const rows = await db.news.findMany({ where: readableWhere(auth), select, orderBy: { createdAt: "desc" }, take: 500 });
  return rows.map((row) => toDTO(auth, row));
}

/** Notes this user sent to the administration, newest first. */
export async function listSentNotes(auth: AuthContext): Promise<NewsDTO[]> {
  const rows = await db.news.findMany({
    where: { authorId: auth.memberId, authorLabel: { not: null } },
    select,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((row) => toDTO(auth, row));
}

/** Publishing announcements is fixed to admins. They carry no signature. */
export async function publishNews(auth: AuthContext, input: z.output<typeof publishNewsSchema>): Promise<{ id: string }> {
  assertRole(auth, "ADMIN");
  return db.news.create({
    data: { text: input.text, audience: input.audience, date: fromISODate(todayISO()), authorId: auth.memberId },
    select: { id: true },
  });
}

/**
 * A note to the administration: appears among the announcements of the admins
 * or the supervisors, signed with the sender's role and name. The signature is
 * built here from the session, never taken from the client.
 */
export async function sendNote(auth: AuthContext, input: z.output<typeof sendNoteSchema>): Promise<{ id: string }> {
  assertCan(auth, "notes.send");
  return db.news.create({
    data: {
      text: input.text,
      audience: input.audience,
      date: fromISODate(todayISO()),
      authorId: auth.memberId,
      authorLabel: noteAuthorLabel(auth.role, auth.name),
    },
    select: { id: true },
  });
}

export async function deleteNews(auth: AuthContext, id: string): Promise<void> {
  const row = await db.news.findUnique({ where: { id }, select: { audience: true, authorId: true } });
  if (!row) throw new NotFoundError("الإعلان غير موجود");
  if (!canDeleteNews(auth, row)) throw new ForbiddenError();
  await db.news.delete({ where: { id } });
}
