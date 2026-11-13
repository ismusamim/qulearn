import { Badge } from "@/components/ui/badge";

import { COLLECTION_STATUS_LABELS, type CollectionStatus, LINE_STATE_LABELS, type LineState } from "../logic";

const OK_CLASS = "bg-success/15 text-success";

export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  if (status === "DONE") return <Badge className={OK_CLASS}>{COLLECTION_STATUS_LABELS.DONE}</Badge>;
  return <Badge variant={status === "RETURNED" ? "destructive" : "secondary"}>{COLLECTION_STATUS_LABELS[status]}</Badge>;
}

export function LineStateBadge({ state }: { state: LineState }) {
  if (state === "OK") return <Badge className={OK_CLASS}>{LINE_STATE_LABELS.OK}</Badge>;
  return <Badge variant={state === "ISSUE" ? "destructive" : "secondary"}>{LINE_STATE_LABELS[state]}</Badge>;
}
