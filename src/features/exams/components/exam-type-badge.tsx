import { Badge } from "@/components/ui/badge";

import { EXAM_TYPE_LABELS, type ExamType } from "../rules";

/** «إتقان جزء 30», «مسابقة المستوى الأول» … */
export function ExamTypeBadge({ type, juz, levelName }: { type: ExamType; juz?: number | null; levelName?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary">{EXAM_TYPE_LABELS[type]}</Badge>
      {type === "MASTERY" && juz ? <span>جزء {juz}</span> : null}
      {type === "COMPETITION" && levelName ? <span>{levelName}</span> : null}
    </span>
  );
}

/** «37.75 / 40», or a dash for an exam without a result. */
export function ExamScore({ total, maxScore }: { total: number | null; maxScore: number | null }) {
  if (total == null) return <>—</>;
  return (
    <span dir="ltr">
      {total} / {maxScore ?? "—"}
    </span>
  );
}
