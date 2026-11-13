import "server-only";

import type { z } from "zod";

import { dueByStudent } from "@/features/fees/dues";
import type { YearMonth } from "@/features/fees/months";
import { Prisma } from "@/generated/prisma/client";
import { fromISODate, todayISO } from "@/lib/dates";
import { type AuthContext, assertCan, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { halaqaLabelMap, listHalaqaOptions } from "@/server/directory";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";

import {
  type CollectionStatus,
  isLocked,
  type LineState,
  linesTotal,
  paymentNote,
  pickNewLines,
  planReview,
  type ReviewFilter,
} from "./logic";
import type { reviewCollectionSchema, saveCollectionSchema } from "./schemas";

// ───────────────────────── Teacher ─────────────────────────

export interface TeacherCollectionRowDTO {
  studentId: string;
  name: string;
  /** The number only: teachers do not see categories or discounts. */
  due: number | null;
  amount: number | null;
  note: string;
  state: LineState | null;
  accountantNote: string;
}

export interface TeacherCollectionDTO {
  halaqat: Array<{ id: string; label: string }>;
  /** Null when the teacher has no halaqa yet. */
  halaqaId: string | null;
  collection: { id: string; status: CollectionStatus; accountantNote: string; reviewedByName: string | null } | null;
  /** Sent or fully confirmed: nothing can be edited. */
  locked: boolean;
  rows: TeacherCollectionRowDTO[];
}

/** The teacher's page: own halaqa, its active students with their due, and the list saved for the month. */
export async function getTeacherCollection(auth: AuthContext, halaqaId: string | null, month: YearMonth): Promise<TeacherCollectionDTO> {
  assertRole(auth, "TEACHER");
  const halaqat = (await listHalaqaOptions({ teacherId: auth.memberId })).map((h) => ({ id: h.id, label: h.label }));
  const selected = halaqat.find((h) => h.id === halaqaId) ?? halaqat[0];
  if (!selected) return { halaqat, halaqaId: null, collection: null, locked: false, rows: [] };

  const collection = await db.collection.findFirst({
    where: { teacherId: auth.memberId, halaqaId: selected.id, year: month.year, month: month.month },
    include: { lines: true },
  });
  const lineOf = new Map((collection?.lines ?? []).map((l) => [l.studentId, l]));

  // Active students, plus dropped ones that already have a line in this list.
  const students = await db.studentProfile.findMany({
    where: {
      halaqaId: selected.id,
      member: { role: "STUDENT" },
      OR: [{ status: "ACTIVE" }, { memberId: { in: [...lineOf.keys()] } }],
    },
    select: { memberId: true, member: { select: { name: true } } },
  });
  const dues = await dueByStudent({ memberId: { in: students.map((s) => s.memberId) } });

  return {
    halaqat,
    halaqaId: selected.id,
    collection: collection && {
      id: collection.id,
      status: collection.status,
      accountantNote: collection.accountantNote,
      reviewedByName: collection.reviewedByName,
    },
    locked: isLocked(collection?.status),
    rows: students
      .map((s) => {
        const line = lineOf.get(s.memberId);
        return {
          studentId: s.memberId,
          name: s.member.name,
          due: dues.get(s.memberId) ?? null,
          amount: line ? Number(line.amount) : null,
          note: line?.note ?? "",
          state: line?.state ?? null,
          accountantNote: line?.accountantNote ?? "",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ar")),
  };
}

/**
 * Saves the teacher's list as a draft or sends it to the accountant.
 *  - only the halaqa's own teacher;
 *  - not while the list is with the accountant (SENT) or fully confirmed (DONE);
 *  - confirmed (OK) lines never change; every other line is replaced by the input;
 *  - only students of that halaqa, and only lines with an amount or a note;
 *  - sending needs at least one new line.
 */
export async function saveCollection(auth: AuthContext, input: z.output<typeof saveCollectionSchema>): Promise<{ id: string }> {
  assertRole(auth, "TEACHER");
  const { halaqaId, year, month, send } = input;
  const halaqa = await db.halaqa.findFirst({ where: { id: halaqaId, teacherId: auth.memberId }, select: { id: true } });
  if (!halaqa) throw new ForbiddenError("غير مصرح: هذه ليست حلقتك");

  const status = send ? "SENT" : "DRAFT";
  const sentAt = send ? { sentAt: new Date() } : {};
  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.collection.findFirst({
        where: { teacherId: auth.memberId, halaqaId, year, month },
        select: { id: true },
      });
      let id: string;
      if (existing) {
        // The conditional update locks the row and re-checks the status, so a save racing
        // with another save (or with the accountant's review) cannot slip through.
        const updated = await tx.collection.updateMany({
          where: { id: existing.id, status: { in: ["DRAFT", "RETURNED"] } },
          data: { teacherName: auth.name, status, ...sentAt },
        });
        if (updated.count === 0) {
          const now = await tx.collection.findUnique({ where: { id: existing.id }, select: { status: true } });
          throw new ConflictError(now?.status === "DONE" ? "أكّد المحاسب القائمة كاملة" : "القائمة عند المحاسب للمراجعة");
        }
        id = existing.id;
      } else {
        const created = await tx.collection.create({
          data: { teacherId: auth.memberId, teacherName: auth.name, halaqaId, year, month, status, ...sentAt },
          select: { id: true },
        });
        id = created.id;
      }

      const [confirmed, inHalaqa] = await Promise.all([
        tx.collectionLine.findMany({ where: { collectionId: id, state: "OK" }, select: { studentId: true } }),
        tx.studentProfile.findMany({
          where: { halaqaId, member: { role: "STUDENT" }, memberId: { in: input.lines.map((l) => l.studentId) } },
          select: { memberId: true },
        }),
      ]);
      const lines = pickNewLines(
        input.lines,
        new Set(inHalaqa.map((s) => s.memberId)),
        new Set(confirmed.map((l) => l.studentId)),
      );
      if (send && lines.length === 0) throw new ConflictError("لا توجد مبالغ جديدة للإرسال");

      await tx.collectionLine.deleteMany({ where: { collectionId: id, state: { not: "OK" } } });
      if (lines.length > 0) {
        await tx.collectionLine.createMany({ data: lines.map((l) => ({ collectionId: id, ...l })) });
      }
      return { id };
    });
  } catch (error) {
    // Two first saves at once: the unique (teacher, halaqa, year, month) key rejects the second.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("حُفظت القائمة للتو من مكان آخر، حدّث الصفحة ثم أعد المحاولة");
    }
    throw error;
  }
}

// ───────────────────────── Accountant / admin ─────────────────────────

export interface CollectionSummaryDTO {
  id: string;
  teacherName: string;
  halaqaLabel: string | null;
  year: number;
  month: number;
  lineCount: number;
  total: number;
  status: CollectionStatus;
}

export interface CollectionListDTO {
  collections: CollectionSummaryDTO[];
  /** Lists waiting for review, whatever the filter. */
  waiting: number;
}

/** Lists sent by teachers (drafts are private to the teacher), newest first. */
export async function listCollectionsForReview(auth: AuthContext, filter: ReviewFilter): Promise<CollectionListDTO> {
  assertCan(auth, "fees.collect");
  const status: Prisma.CollectionWhereInput["status"] =
    filter === "all" ? { not: "DRAFT" } : filter === "sent" ? "SENT" : filter === "returned" ? "RETURNED" : "DONE";
  const [rows, waiting, halaqat] = await Promise.all([
    db.collection.findMany({
      where: { status },
      include: { lines: { select: { amount: true } } },
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    }),
    db.collection.count({ where: { status: "SENT" } }),
    halaqaLabelMap(),
  ]);
  return {
    waiting,
    collections: rows.map((c) => ({
      id: c.id,
      teacherName: c.teacherName ?? "",
      halaqaLabel: (c.halaqaId && halaqat.get(c.halaqaId)?.label) || null,
      year: c.year,
      month: c.month,
      lineCount: c.lines.length,
      total: linesTotal(c.lines.map((l) => ({ amount: Number(l.amount) }))),
      status: c.status,
    })),
  };
}

export interface CollectionLineDTO {
  studentId: string;
  name: string;
  due: number | null;
  amount: number;
  /** Collected − due; null when the due is unknown. */
  diff: number | null;
  note: string;
  state: LineState;
  accountantNote: string;
}

export interface CollectionDetailDTO extends CollectionSummaryDTO {
  accountantNote: string;
  reviewedByName: string | null;
  lines: CollectionLineDTO[];
}

export async function getCollectionForReview(auth: AuthContext, id: string): Promise<CollectionDetailDTO> {
  assertCan(auth, "fees.collect");
  const c = await db.collection.findFirst({
    where: { id, status: { not: "DRAFT" } },
    include: { lines: { include: { student: { select: { name: true } } } } },
  });
  if (!c) throw new NotFoundError("القائمة غير موجودة");
  const [halaqat, dues] = await Promise.all([
    halaqaLabelMap(),
    dueByStudent({ memberId: { in: c.lines.map((l) => l.studentId) } }),
  ]);
  const lines = c.lines
    .map((l) => {
      const due = dues.get(l.studentId) ?? null;
      const amount = Number(l.amount);
      return {
        studentId: l.studentId,
        name: l.student.name,
        due,
        amount,
        diff: due == null ? null : Math.round((amount - due) * 100) / 100,
        note: l.note,
        state: l.state,
        accountantNote: l.accountantNote,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  return {
    id: c.id,
    teacherName: c.teacherName ?? "",
    halaqaLabel: (c.halaqaId && halaqat.get(c.halaqaId)?.label) || null,
    year: c.year,
    month: c.month,
    lineCount: lines.length,
    total: linesTotal(lines),
    status: c.status,
    accountantNote: c.accountantNote,
    reviewedByName: c.reviewedByName,
    lines,
  };
}

export interface ReviewResultDTO {
  status: CollectionStatus;
  confirmed: number;
  returned: number;
}

/**
 * Applies the accountant's decisions in one transaction: confirmed lines with an
 * amount become fee payments stamped with the reviewer, returned lines go back to
 * the teacher with a note, and the list becomes RETURNED / SENT / DONE.
 */
export async function reviewCollection(auth: AuthContext, input: z.output<typeof reviewCollectionSchema>): Promise<ReviewResultDTO> {
  assertCan(auth, "fees.collect");
  const id = input.collectionId;
  return db.$transaction(async (tx) => {
    // Lock the row and re-check that it is still waiting: a second submission of the same
    // review waits here, then finds either another status or no pending lines left.
    const locked = await tx.collection.updateMany({ where: { id, status: "SENT" }, data: { reviewedAt: new Date() } });
    if (locked.count === 0) {
      const exists = await tx.collection.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundError("القائمة غير موجودة");
      throw new ConflictError("القائمة ليست بانتظار المراجعة");
    }
    const c = await tx.collection.findUniqueOrThrow({
      where: { id },
      select: { year: true, month: true, teacherName: true, lines: { where: { state: "PENDING" } } },
    });
    const plan = planReview(
      c.lines.map((l) => ({ id: l.id, studentId: l.studentId, amount: Number(l.amount), note: l.note })),
      input.decisions,
    );

    const paid = plan.confirmed.filter((l) => l.amount > 0);
    if (paid.length > 0) {
      const date = fromISODate(todayISO());
      await tx.feePayment.createMany({
        data: paid.map((l) => ({
          studentId: l.studentId,
          year: c.year,
          month: c.month,
          amount: l.amount,
          date,
          // Always the reviewer, never anything from the input.
          collectedById: auth.memberId,
          collectedByName: auth.name,
          note: paymentNote(c.teacherName, l.note),
        })),
      });
    }
    for (const line of plan.confirmed) {
      await tx.collectionLine.update({ where: { id: line.id }, data: { state: "OK", accountantNote: line.accountantNote } });
    }
    for (const line of plan.returned) {
      await tx.collectionLine.update({ where: { id: line.id }, data: { state: "ISSUE", accountantNote: line.accountantNote } });
    }
    await tx.collection.update({
      where: { id },
      data: { status: plan.status, accountantNote: input.note, reviewedByName: auth.name },
    });
    return { status: plan.status, confirmed: plan.confirmed.length, returned: plan.returned.length };
  });
}
