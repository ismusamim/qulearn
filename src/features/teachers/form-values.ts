import type { MyPersonalInput, MyTechnicalInput, TeacherFormInput } from "./schemas";
import type { TeacherFileDTO } from "./service";

/** DTO → initial values of the forms (numbers are edited as text so they can be left empty). */

const numberText = (value: number | null) => (value === null ? "" : String(value));

export function personalFormValues(teacher: TeacherFileDTO): MyPersonalInput {
  return { ...teacher.personal, phone: teacher.phone };
}

export function technicalFormValues(teacher: TeacherFileDTO): MyTechnicalInput {
  return {
    ...teacher.technical,
    memorizedParts: numberText(teacher.technical.memorizedParts),
    experienceYears: numberText(teacher.technical.experienceYears),
  };
}

export function teacherFormValues(teacher: TeacherFileDTO): TeacherFormInput {
  return {
    name: teacher.name,
    ...personalFormValues(teacher),
    ...teacher.administrative,
    monthlyPay: numberText(teacher.administrative.monthlyPay),
    ...technicalFormValues(teacher),
  };
}
