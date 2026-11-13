"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import {
  competitionIdSchema,
  competitionSchema,
  createExamSchema,
  createLevelSchema,
  examIdSchema,
  levelIdSchema,
  markingSettingsSchema,
  suggestQuestionsSchema,
  updateCompetitionSchema,
  updateExamSchema,
  updateLevelSchema,
} from "./schemas";
import * as examsService from "./service";
import * as settingsService from "./settings-service";

export async function createExamAction(input: unknown) {
  return runAction(createExamSchema, input, async (data, auth) => {
    const saved = await examsService.createExam(auth, data);
    revalidatePath("/exams");
    return saved;
  });
}

export async function updateExamAction(input: unknown) {
  return runAction(updateExamSchema, input, async (data, auth) => {
    const saved = await examsService.updateExam(auth, data);
    revalidatePath("/exams");
    revalidatePath(`/exams/${saved.id}`);
    return saved;
  });
}

export async function deleteExamAction(input: unknown) {
  return runAction(examIdSchema, input, async ({ id }, auth) => {
    await examsService.deleteExam(auth, id);
    revalidatePath("/exams");
  });
}

/** Read-only, but needs the student's records, so it goes through the server. */
export async function suggestQuestionsAction(input: unknown) {
  return runAction(suggestQuestionsSchema, input, (data, auth) => examsService.suggestQuestions(auth, data));
}

export async function updateMarkingSettingsAction(input: unknown) {
  return runAction(markingSettingsSchema, input, async (data, auth) => {
    await settingsService.updateMarkingSettings(auth, data);
    revalidatePath("/exams");
  });
}

export async function createCompetitionAction(input: unknown) {
  return runAction(competitionSchema, input, async (data, auth) => {
    const competition = await settingsService.createCompetition(auth, data);
    revalidatePath("/exams");
    return competition;
  });
}

export async function updateCompetitionAction(input: unknown) {
  return runAction(updateCompetitionSchema, input, async (data, auth) => {
    await settingsService.updateCompetition(auth, data);
    revalidatePath("/exams");
  });
}

export async function deleteCompetitionAction(input: unknown) {
  return runAction(competitionIdSchema, input, async ({ id }, auth) => {
    await settingsService.deleteCompetition(auth, id);
    revalidatePath("/exams");
  });
}

export async function createLevelAction(input: unknown) {
  return runAction(createLevelSchema, input, async (data, auth) => {
    const level = await settingsService.createLevel(auth, data);
    revalidatePath("/exams");
    return level;
  });
}

export async function updateLevelAction(input: unknown) {
  return runAction(updateLevelSchema, input, async (data, auth) => {
    await settingsService.updateLevel(auth, data);
    revalidatePath("/exams");
  });
}

export async function deleteLevelAction(input: unknown) {
  return runAction(levelIdSchema, input, async ({ id }, auth) => {
    await settingsService.deleteLevel(auth, id);
    revalidatePath("/exams");
  });
}
