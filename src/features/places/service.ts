import "server-only";

import type { z } from "zod";

import { type AuthContext, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { ConflictError, NotFoundError } from "@/server/errors";

import type { placeSchema, updatePlaceSchema } from "./schemas";

/** What the UI receives: plain serialisable data, never a Prisma model. */
export interface PlaceDTO {
  id: string;
  name: string;
  type: "MOSQUE" | "DAR";
  address: string;
  halaqaCount: number;
}

/** Everyone signed in may read places; only admins manage them. */
export async function listPlaces(_auth: AuthContext): Promise<PlaceDTO[]> {
  const rows = await db.place.findMany({
    include: { _count: { select: { halaqat: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, type: p.type, address: p.address, halaqaCount: p._count.halaqat }));
}

async function assertNameFree(name: string, exceptId?: string): Promise<void> {
  const clash = await db.place.findFirst({
    where: { name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new ConflictError("يوجد مكان بالاسم نفسه");
}

export async function createPlace(auth: AuthContext, input: z.output<typeof placeSchema>): Promise<{ id: string }> {
  assertRole(auth, "ADMIN");
  await assertNameFree(input.name);
  return db.place.create({ data: input, select: { id: true } });
}

export async function updatePlace(auth: AuthContext, input: z.output<typeof updatePlaceSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const { id, ...data } = input;
  const existing = await db.place.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("المكان غير موجود");
  await assertNameFree(data.name, id);
  await db.place.update({ where: { id }, data });
}

/** Deleting a place keeps its halaqat; they simply lose their place. */
export async function deletePlace(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  const existing = await db.place.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("المكان غير موجود");
  await db.place.delete({ where: { id } });
}
