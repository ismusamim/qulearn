import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { HalaqaStudentsDialog } from "@/features/halaqat/components/halaqa-students-dialog";
import { HalaqatSection } from "@/features/halaqat/components/halaqat-section";
import { getHalaqaFormOptions, getHalaqaStudents, listHalaqat } from "@/features/halaqat/service";
import { PlacesTable } from "@/features/places/components/places-table";
import { listPlaces } from "@/features/places/service";
import { hasRole, requirePage } from "@/server/auth";

export const metadata: Metadata = { title: "الأماكن والحلقات" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function HalaqatPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requirePage((a) => hasRole(a, "ADMIN"));
  const searchParams = await props.searchParams;
  // ?h=<id> opens that halaqa's students; ?q= and ?place= are the list filters.
  const openId = first(searchParams.h);

  const [places, halaqat, options, opened] = await Promise.all([
    listPlaces(auth),
    listHalaqat(auth),
    getHalaqaFormOptions(auth),
    UUID.test(openId) ? getHalaqaStudents(auth, openId) : null,
  ]);

  return (
    <>
      <PageHeader
        title="الأماكن والحلقات"
        description="كل مكان (مسجد أو دار تحفيظ) يضم حلقة أو أكثر، والحلقة تُسمّى باسم معلمها تلقائيًا."
      />
      <div className="flex flex-col gap-6">
        <PlacesTable places={places} />
        <HalaqatSection
          halaqat={halaqat}
          places={places}
          options={options}
          initialQuery={first(searchParams.q)}
          initialPlace={first(searchParams.place)}
        />
      </div>
      {opened && <HalaqaStudentsDialog key={opened.halaqa.id} data={opened} />}
    </>
  );
}
