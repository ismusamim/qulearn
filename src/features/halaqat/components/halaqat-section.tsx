"use client";

import { useState, useTransition } from "react";

import { PlusIcon, SearchIcon, UsersRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaceFormDialog } from "@/features/places/components/place-form-dialog";
import { normalizeArabic } from "@/lib/arabic";

import type { HalaqaDTO, HalaqaFormOptions } from "../service";
import { HalaqaFormDialog, type PlaceChoice } from "./halaqa-form-dialog";
import { HalaqaGroupCard } from "./halaqa-group-card";

type Place = PlaceChoice & { address: string };

/** Values of the place filter that are not a place id. */
const ALL = "all";
const NO_PLACE = "none";

function hrefFor(query: string, place: string, halaqaId?: string): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (place !== ALL) params.set("place", place);
  if (halaqaId) params.set("h", halaqaId);
  const qs = params.toString();
  return qs ? `/halaqat?${qs}` : "/halaqat";
}

/** The halaqat, grouped by place, with search and a place filter (both kept in the URL). */
export function HalaqatSection({
  halaqat,
  places,
  options,
  initialQuery,
  initialPlace,
}: {
  halaqat: HalaqaDTO[];
  places: Place[];
  options: HalaqaFormOptions;
  initialQuery: string;
  initialPlace: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [place, setPlace] = useState(
    initialPlace === NO_PLACE || places.some((p) => p.id === initialPlace) ? initialPlace : ALL,
  );
  const [opening, startOpening] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Filtering is instant on the client; the URL is only updated so a reload keeps the view.
  const changeFilters = (nextQuery: string, nextPlace: string) => {
    setQuery(nextQuery);
    setPlace(nextPlace);
    window.history.replaceState(null, "", hrefFor(nextQuery, nextPlace));
  };

  // The students list is loaded by the page (?h=<id>) and shown in a dialog.
  const openStudents = (id: string) => {
    setOpeningId(id);
    startOpening(() => router.push(hrefFor(query, place, id), { scroll: false }));
  };

  const needle = normalizeArabic(query);
  const matches = (h: HalaqaDTO) =>
    !needle ||
    [h.label, h.teacherName, h.supervisorName, h.placeName, h.name].some((text) => normalizeArabic(text).includes(needle));
  const filtering = !!needle || place !== ALL;

  const groups = [
    ...places
      .filter((p) => place === ALL || place === p.id)
      .map((p) => ({ place: p as Place | null, list: halaqat.filter((h) => h.placeId === p.id && matches(h)) })),
    ...(place === ALL || place === NO_PLACE
      ? [{ place: null as Place | null, list: halaqat.filter((h) => !h.placeId && matches(h)) }]
      : []),
    // Empty places are worth showing (to add a halaqa there) unless the user is looking for something.
  ].filter((g) => g.list.length > 0 || (g.place !== null && !needle));
  const shown = groups.reduce((sum, g) => sum + g.list.length, 0);
  const hasOrphans = halaqat.some((h) => !h.placeId);

  const addButton = (
    <Button size="sm">
      <PlusIcon />
      حلقة جديدة
    </Button>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">الحلقات</h2>
        <span className="text-sm text-muted-foreground">
          {filtering ? `${shown} من ${halaqat.length} حلقة` : `${places.length} مكان · ${halaqat.length} حلقة`}
        </span>
        <div className="no-print ms-auto flex flex-wrap items-center gap-2">
          <InputGroup className="w-56">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="بحث باسم المعلم أو المشرف…"
              aria-label="بحث في الحلقات"
              value={query}
              onChange={(e) => changeFilters(e.target.value, place)}
            />
          </InputGroup>
          <Select value={place} onValueChange={(value) => changeFilters(query, value)}>
            <SelectTrigger className="w-44" aria-label="المكان">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الأماكن</SelectItem>
              {places.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
              {hasOrphans && <SelectItem value={NO_PLACE}>بلا مكان</SelectItem>}
            </SelectContent>
          </Select>
          {places.length === 0 ? (
            // A halaqa needs a place: send the admin to create one first.
            <PlaceFormDialog>
              <Button size="sm" onClick={() => toast.info("أضف مكانًا أولًا")}>
                <PlusIcon />
                حلقة جديدة
              </Button>
            </PlaceFormDialog>
          ) : (
            <HalaqaFormDialog places={places} options={options} presetPlaceId={place !== ALL && place !== NO_PLACE ? place : undefined}>
              {addButton}
            </HalaqaFormDialog>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRoundIcon}
          title={filtering ? "لا توجد حلقات مطابقة" : "لا توجد حلقات بعد"}
          description={filtering ? "جرّب بحثًا آخر أو مكانًا آخر." : "أضف مكانًا ثم أنشئ فيه حلقة؛ الحلقة تُسمّى باسم معلمها تلقائيًا."}
        />
      ) : (
        groups.map((group) => (
          <HalaqaGroupCard
            key={group.place?.id ?? NO_PLACE}
            place={group.place}
            halaqat={group.list}
            places={places}
            options={options}
            openingId={opening ? openingId : null}
            onOpenStudents={openStudents}
          />
        ))
      )}
    </section>
  );
}
