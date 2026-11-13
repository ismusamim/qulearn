"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { SupervisorNoteDTO } from "../service";
import { ExamScore } from "./exam-type-badge";

/**
 * Which notes this teacher has already seen is remembered per device in
 * localStorage (a UI convenience only, as in the old app). The value is read
 * once per visit, so notes stay marked «جديدة» while the page is open and lose
 * the mark the next time it is opened.
 */
const MAX_REMEMBERED = 500;
const snapshots = new Map<string, string>();
const mounted = new Map<string, number>();

function readSeen(key: string): string {
  let value = snapshots.get(key);
  if (value === undefined) {
    try {
      value = localStorage.getItem(key) ?? "[]";
    } catch {
      value = "[]";
    }
    snapshots.set(key, value);
  }
  return value;
}

function parseIds(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const subscribe = () => () => {};

/** «ملاحظات المشرف على اختبارات المتابعة» — shown to the teacher of the students' halaqa. */
export function SupervisorNotes({ notes, memberId }: { notes: SupervisorNoteDTO[]; memberId: string }) {
  const key = `exam_seen_${memberId}`;
  // null on the server and while hydrating: nothing is highlighted until the device's list is known.
  const raw = useSyncExternalStore(
    subscribe,
    () => readSeen(key),
    () => null,
  );
  const seen = useMemo(() => (raw === null ? null : new Set(parseIds(raw))), [raw]);
  const isNew = (id: string) => seen !== null && !seen.has(id);
  const fresh = notes.filter((n) => isNew(n.id)).length;

  useEffect(() => {
    if (raw === null) return;
    const ids = parseIds(raw);
    const unseen = notes.map((n) => n.id).filter((id) => !ids.includes(id));
    if (unseen.length) {
      try {
        localStorage.setItem(key, JSON.stringify([...ids, ...unseen].slice(-MAX_REMEMBERED)));
      } catch {
        // Storage unavailable: the notes simply stay marked as new.
      }
    }
    mounted.set(key, (mounted.get(key) ?? 0) + 1);
    return () => {
      mounted.set(key, (mounted.get(key) ?? 1) - 1);
      // Forget the snapshot once the page is really left (not on a development double-mount),
      // so the next visit reads the updated list.
      setTimeout(() => {
        if (!mounted.get(key)) snapshots.delete(key);
      }, 0);
    };
  }, [key, raw, notes]);

  if (notes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          ملاحظات المشرف على اختبارات المتابعة
          {fresh > 0 && <Badge variant="destructive">{fresh} جديدة</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {notes.map((note) => (
          <div key={note.id} className={cn("rounded-lg border bg-muted/40 p-3 text-sm", isNew(note.id) && "border-s-4 border-s-gold")}>
            <p>
              <b>{note.studentName}</b>
              {" — "}
              {note.grade} (<ExamScore total={note.total} maxScore={note.maxScore} />)
            </p>
            <p className="mt-1 whitespace-pre-wrap">{note.note}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <span dir="ltr">{note.date}</span>
              {note.examinerName ? ` — ${note.examinerName}` : ""}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
