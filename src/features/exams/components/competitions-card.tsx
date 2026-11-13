"use client";

import { PencilIcon, PlusIcon, Trash2Icon, TrophyIcon } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";

import { deleteCompetitionAction, deleteLevelAction } from "../actions";
import type { CompetitionDTO } from "../settings-service";
import { CompetitionFormDialog, LevelFormDialog } from "./competition-dialogs";

/** Admin only: competitions, each with its levels (range of ajza and number of questions). */
export function CompetitionsCard({ competitions }: { competitions: CompetitionDTO[] }) {
  const removeCompetition = useAction(deleteCompetitionAction, { successMessage: "تم حذف المسابقة" });
  const removeLevel = useAction(deleteLevelAction, { successMessage: "تم حذف المستوى" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>المسابقات ومستوياتها</CardTitle>
        <CardAction>
          <CompetitionFormDialog>
            <Button size="sm">
              <PlusIcon />
              مسابقة
            </Button>
          </CompetitionFormDialog>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {competitions.length === 0 && (
          <EmptyState icon={TrophyIcon} title="لا توجد مسابقات." description="أضف مسابقة ثم مستوياتها (الأجزاء وعدد الأسئلة من 2 إلى 5)." />
        )}
        {competitions.map((competition) => (
          <div key={competition.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-1">
              <b className="min-w-0 flex-1">{competition.name}</b>
              <LevelFormDialog competitionId={competition.id}>
                <Button variant="outline" size="sm">
                  <PlusIcon />
                  مستوى
                </Button>
              </LevelFormDialog>
              <CompetitionFormDialog competition={competition}>
                <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${competition.name}`}>
                  <PencilIcon />
                </Button>
              </CompetitionFormDialog>
              <ConfirmDialog
                title="حذف المسابقة ومستوياتها؟"
                description="نتائج اختباراتها السابقة تبقى."
                confirmLabel="حذف"
                destructive
                onConfirm={() => removeCompetition.execute({ id: competition.id })}
              >
                <Button variant="ghost" size="icon-sm" aria-label={`حذف ${competition.name}`} disabled={removeCompetition.pending}>
                  <Trash2Icon className="text-destructive" />
                </Button>
              </ConfirmDialog>
            </div>
            {competition.levels.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">لا توجد مستويات بعد.</p>
            ) : (
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>المستوى</TableHead>
                    <TableHead>الأجزاء</TableHead>
                    <TableHead>عدد الأسئلة</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competition.levels.map((level) => (
                    <TableRow key={level.id}>
                      <TableCell className="font-medium">{level.name}</TableCell>
                      <TableCell>
                        من {level.fromJuz} إلى {level.toJuz}
                      </TableCell>
                      <TableCell>{level.questionCount}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <LevelFormDialog competitionId={competition.id} level={level}>
                            <Button variant="ghost" size="icon-sm" aria-label={`تعديل ${level.name}`}>
                              <PencilIcon />
                            </Button>
                          </LevelFormDialog>
                          <ConfirmDialog
                            title={`حذف «${level.name}»؟`}
                            description="نتائج الاختبارات السابقة في هذا المستوى تبقى."
                            confirmLabel="حذف"
                            destructive
                            onConfirm={() => removeLevel.execute({ id: level.id })}
                          >
                            <Button variant="ghost" size="icon-sm" aria-label={`حذف ${level.name}`} disabled={removeLevel.pending}>
                              <Trash2Icon className="text-destructive" />
                            </Button>
                          </ConfirmDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
