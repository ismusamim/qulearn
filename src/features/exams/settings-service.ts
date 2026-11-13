import "server-only";

import type { z } from "zod";

import { type AuthContext, assertRole } from "@/server/auth";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";

import type {
  competitionSchema,
  createLevelSchema,
  markingSettingsSchema,
  updateCompetitionSchema,
  updateLevelSchema,
} from "./schemas";
import { DEFAULT_MARKING, type MarkingSettings, round2 } from "./scoring";

/** Marking settings and competitions: read by everyone who runs exams, managed by the admin only. */

const STAFF = ["TEACHER", "SUPERVISOR", "ADMIN"] as const;

/** Current marking rules (the singleton row, or the defaults before the admin saves any). */
export async function getMarkingSettings(auth: AuthContext): Promise<MarkingSettings> {
  assertRole(auth, ...STAFF);
  return readMarkingSettings();
}

/** For other functions of this feature that have already authorised the caller. */
export async function readMarkingSettings(): Promise<MarkingSettings> {
  const row = await db.examSettings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_MARKING;
  return {
    questionScore: Number(row.questionScore),
    mistakePenalty: Number(row.mistakePenalty),
    promptPenalty: Number(row.promptPenalty),
    tajweedPenalty: Number(row.tajweedPenalty),
    excellentFrom: row.excellentFrom,
    veryGoodFrom: row.veryGoodFrom,
    goodFrom: row.goodFrom,
    passFrom: row.passFrom,
  };
}

/** New values apply to exams saved from now on; stored results are not re-marked. */
export async function updateMarkingSettings(auth: AuthContext, input: z.output<typeof markingSettingsSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const data = {
    ...input,
    questionScore: round2(input.questionScore),
    mistakePenalty: round2(input.mistakePenalty),
    promptPenalty: round2(input.promptPenalty),
    tajweedPenalty: round2(input.tajweedPenalty),
  };
  await db.examSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

// ───────────── Competitions ─────────────

export interface LevelDTO {
  id: string;
  name: string;
  fromJuz: number;
  toJuz: number;
  questionCount: number;
}

export interface CompetitionDTO {
  id: string;
  name: string;
  levels: LevelDTO[];
}

export async function listCompetitions(auth: AuthContext): Promise<CompetitionDTO[]> {
  assertRole(auth, ...STAFF);
  const rows = await db.competition.findMany({
    select: {
      id: true,
      name: true,
      levels: {
        select: { id: true, name: true, fromJuz: true, toJuz: true, questionCount: true },
        orderBy: [{ toJuz: "desc" }, { fromJuz: "desc" }, { name: "asc" }],
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows;
}

async function assertCompetition(id: string): Promise<void> {
  const found = await db.competition.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new NotFoundError("المسابقة غير موجودة");
}

async function assertLevel(id: string): Promise<void> {
  const found = await db.competitionLevel.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new NotFoundError("المستوى غير موجود");
}

export async function createCompetition(auth: AuthContext, input: z.output<typeof competitionSchema>): Promise<{ id: string }> {
  assertRole(auth, "ADMIN");
  return db.competition.create({ data: { name: input.name }, select: { id: true } });
}

export async function updateCompetition(auth: AuthContext, input: z.output<typeof updateCompetitionSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  await assertCompetition(input.id);
  await db.competition.update({ where: { id: input.id }, data: { name: input.name } });
}

/** Deletes the competition with its levels; past exams keep the snapshotted names. */
export async function deleteCompetition(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  await assertCompetition(id);
  await db.competition.delete({ where: { id } });
}

export async function createLevel(auth: AuthContext, input: z.output<typeof createLevelSchema>): Promise<{ id: string }> {
  assertRole(auth, "ADMIN");
  await assertCompetition(input.competitionId);
  return db.competitionLevel.create({ data: input, select: { id: true } });
}

export async function updateLevel(auth: AuthContext, input: z.output<typeof updateLevelSchema>): Promise<void> {
  assertRole(auth, "ADMIN");
  const { id, ...data } = input;
  await assertLevel(id);
  await db.competitionLevel.update({ where: { id }, data });
}

export async function deleteLevel(auth: AuthContext, id: string): Promise<void> {
  assertRole(auth, "ADMIN");
  await assertLevel(id);
  await db.competitionLevel.delete({ where: { id } });
}
