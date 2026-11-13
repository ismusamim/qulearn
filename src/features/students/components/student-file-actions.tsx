"use client";

import { useState } from "react";

import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { DeleteStudentDialog } from "./delete-student-dialog";

/** Admin's delete button on the student file; returns to the list afterwards. */
export function DeleteStudentButton({ student }: { student: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        <Trash2Icon />
        حذف
      </Button>
      {open && <DeleteStudentDialog student={student} onClose={() => setOpen(false)} onDeleted={() => router.replace("/students")} />}
    </>
  );
}
