"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/action";

import { newsIdSchema, publishNewsSchema, sendNoteSchema } from "./schemas";
import * as newsService from "./service";

function revalidate() {
  revalidatePath("/news");
  revalidatePath("/notes");
  // The admin dashboard shows the latest announcements too.
  revalidatePath("/dashboard");
}

export async function publishNewsAction(input: unknown) {
  return runAction(publishNewsSchema, input, async (data, auth) => {
    const news = await newsService.publishNews(auth, data);
    revalidate();
    return news;
  });
}

export async function sendNoteAction(input: unknown) {
  return runAction(sendNoteSchema, input, async (data, auth) => {
    const note = await newsService.sendNote(auth, data);
    revalidate();
    return note;
  });
}

export async function deleteNewsAction(input: unknown) {
  return runAction(newsIdSchema, input, async ({ id }, auth) => {
    await newsService.deleteNews(auth, id);
    revalidate();
  });
}
