import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { type HalaqaNaming, halaqaLabel, scheduleText } from "@/lib/domain/halaqa";
import { db } from "@/server/db";

/**
 * Read-only lookups that several features need (dropdown options, labels).
 * These return names only and perform NO authorisation: call them from a
 * service or page that has already decided the user may see the list.
 */

export interface HalaqaOption {
  id: string;
  /** «حلقة الشيخ أحمد» — see halaqaLabel. */
  label: string;
  schedule: string;
  teacherId: string | null;
  teacherName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  placeId: string | null;
  placeName: string | null;
  studentCount: number;
}

/** Every halaqa with its display label. Memoised per request. */
export const listAllHalaqaOptions = cache(async (): Promise<HalaqaOption[]> => {
  const rows = await db.halaqa.findMany({
    include: {
      teacher: { select: { name: true } },
      supervisor: { select: { name: true } },
      place: { select: { name: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ teacher: { name: "asc" } }, { name: "asc" }],
  });
  const naming: HalaqaNaming[] = rows.map((h) => ({
    id: h.id,
    name: h.name,
    teacherId: h.teacherId,
    teacherName: h.teacher?.name ?? null,
    placeId: h.placeId,
    placeName: h.place?.name ?? null,
    scheduleMode: h.scheduleMode,
    startTime: h.startTime,
    endTime: h.endTime,
    startPrayer: h.startPrayer,
    endPrayer: h.endPrayer,
  }));
  return rows.map((h, i) => ({
    id: h.id,
    label: halaqaLabel(naming[i], naming),
    schedule: scheduleText(naming[i]),
    teacherId: h.teacherId,
    teacherName: h.teacher?.name ?? null,
    supervisorId: h.supervisorId,
    supervisorName: h.supervisor?.name ?? null,
    placeId: h.placeId,
    placeName: h.place?.name ?? null,
    studentCount: h._count.students,
  }));
});

/** Halaqa options restricted by a Prisma filter, e.g. `managedHalaqaWhere(auth)`. */
export async function listHalaqaOptions(where: Prisma.HalaqaWhereInput): Promise<HalaqaOption[]> {
  const [all, allowed] = await Promise.all([
    listAllHalaqaOptions(),
    db.halaqa.findMany({ where, select: { id: true } }),
  ]);
  const ids = new Set(allowed.map((h) => h.id));
  return all.filter((h) => ids.has(h.id));
}

/** id → label map, for rendering lists that reference halaqat. */
export async function halaqaLabelMap(): Promise<Map<string, HalaqaOption>> {
  return new Map((await listAllHalaqaOptions()).map((h) => [h.id, h]));
}

export interface PlaceOption {
  id: string;
  name: string;
  type: "MOSQUE" | "DAR";
}

export const listPlaceOptions = cache(async (): Promise<PlaceOption[]> => {
  return db.place.findMany({ select: { id: true, name: true, type: true }, orderBy: { name: "asc" } });
});

export interface MemberOption {
  id: string;
  name: string;
}

/** Names of all members of a role (teachers, supervisors…), for dropdowns. */
export async function listMemberOptions(role: "TEACHER" | "SUPERVISOR" | "ACCOUNTANT" | "ADMIN" | "STUDENT"): Promise<MemberOption[]> {
  return db.member.findMany({ where: { role }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export interface CustomFieldDef {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "DATE" | "TEXTAREA";
}

/** Admin-defined extra fields for students or teachers (values live in Member.extra). */
export async function listCustomFields(kind: "STUDENTS" | "TEACHERS"): Promise<CustomFieldDef[]> {
  return db.customField.findMany({ where: { kind }, select: { key: true, label: true, type: true }, orderBy: { label: "asc" } });
}
