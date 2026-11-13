"use client";

import { Badge } from "@/components/ui/badge";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fixName, normalizeArabic } from "@/lib/arabic";

import { type FieldTarget, type ImportKind, TARGET_HALAQA, TARGET_PHONE } from "../fields";
import { type ColumnMatch, MAP_PENDING, MAP_SKIP, type TableAnalysis } from "../matching";

const PREVIEW_ROWS = 8;

/** Up to two example values of a column, so the admin recognises what it holds. */
function samples(analysis: TableAnalysis, index: number): string {
  const found: string[] = [];
  for (const row of analysis.rows) {
    const value = row[index];
    if (value && !found.includes(value)) found.push(value);
    if (found.length === 2) break;
  }
  return found.join("، ");
}

/**
 * Each column of the file with the field it will be imported into. The admin
 * can re-point a column, keep it as «معلّق» or leave it out.
 */
export function MappingPreview({
  kind,
  analysis,
  columns,
  targets,
  existingNames,
  onChange,
}: {
  kind: ImportKind;
  analysis: TableAnalysis;
  columns: ColumnMatch[];
  targets: FieldTarget[];
  existingNames: ReadonlySet<string>;
  onChange: (index: number, target: string) => void;
}) {
  const used = new Set(columns.map((c) => c.target));
  const columnOf = (target: string) => columns.find((c) => c.target === target)?.index;
  const halaqaColumn = columnOf(TARGET_HALAQA);
  const phoneColumn = columnOf(TARGET_PHONE);

  return (
    <div className="flex flex-col gap-4">
      {columns.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العمود في الملف</TableHead>
              <TableHead>أمثلة</TableHead>
              <TableHead>يُستورد إلى</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columns.map((column) => (
              <TableRow key={column.index}>
                <TableCell className="font-medium">{column.header}</TableCell>
                <TableCell className="max-w-56 truncate text-muted-foreground">{samples(analysis, column.index) || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <NativeSelect
                      size="sm"
                      aria-label={`وجهة العمود ${column.header}`}
                      value={column.target}
                      onChange={(e) => onChange(column.index, e.target.value)}
                    >
                      <NativeSelectOption value={MAP_PENDING}>معلّق — يُحفظ في «بيانات معلّقة»</NativeSelectOption>
                      <NativeSelectOption value={MAP_SKIP}>تجاهل هذا العمود</NativeSelectOption>
                      <NativeSelectOptGroup label="حقول النظام">
                        {targets.map((t) => (
                          <NativeSelectOption key={t.id} value={t.id} disabled={used.has(t.id) && column.target !== t.id}>
                            {t.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    </NativeSelect>
                    {column.target === MAP_PENDING && <Badge variant="outline">معلّق</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الاسم</TableHead>
            {kind === "STUDENTS" && <TableHead>الحلقة</TableHead>}
            <TableHead>الجوال</TableHead>
            <TableHead>الحالة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analysis.rows.slice(0, PREVIEW_ROWS).map((row, i) => {
            const name = fixName(row[analysis.nameColumn]);
            return (
              <TableRow key={i}>
                <TableCell>{name}</TableCell>
                {kind === "STUDENTS" && <TableCell>{(halaqaColumn !== undefined && row[halaqaColumn]) || "—"}</TableCell>}
                <TableCell dir="ltr" className="text-start">
                  {(phoneColumn !== undefined && row[phoneColumn]) || "—"}
                </TableCell>
                <TableCell>
                  {existingNames.has(normalizeArabic(name)) ? <Badge variant="destructive">مكرر</Badge> : <Badge variant="secondary">جديد</Badge>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {analysis.rows.length > PREVIEW_ROWS && (
        <p className="text-sm text-muted-foreground">… و{analysis.rows.length - PREVIEW_ROWS} صفوف أخرى</p>
      )}
    </div>
  );
}
