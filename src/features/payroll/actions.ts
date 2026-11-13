"use server";

import { revalidatePath } from "next/cache";

import { runAction, runSimpleAction } from "@/server/action";

import * as employeesService from "./employees-service";
import {
  addRowSchema,
  employeeSchema,
  employeeStatusSchema,
  idSchema,
  monthSchema,
  setPinSchema,
  settingsSchema,
  unlockSchema,
  updateEmployeeSchema,
  updateRowSchema,
} from "./schemas";
import * as payrollService from "./service";

const refresh = () => revalidatePath("/payroll");

// ───────────── PIN and settings ─────────────

export async function unlockPayrollAction(input: unknown) {
  return runAction(unlockSchema, input, async ({ pin }, auth) => {
    await payrollService.unlockPayroll(auth, pin);
    refresh();
  });
}

export async function setPayrollPinAction(input: unknown) {
  return runAction(setPinSchema, input, async ({ pin }, auth) => {
    await payrollService.setPayrollPin(auth, pin);
    refresh();
  });
}

export async function updatePayrollSettingsAction(input: unknown) {
  return runAction(settingsSchema, input, async (data, auth) => {
    await payrollService.updatePayrollSettings(auth, data);
    refresh();
  });
}

// ───────────── Month sheet ─────────────

export async function createMonthAction(input: unknown) {
  return runAction(monthSchema, input, async (data, auth) => {
    const result = await payrollService.createMonth(auth, data);
    refresh();
    return result;
  });
}

export async function addRowAction(input: unknown) {
  return runAction(addRowSchema, input, async (data, auth) => {
    await payrollService.addRow(auth, data);
    refresh();
  });
}

export async function updateRowAction(input: unknown) {
  return runAction(updateRowSchema, input, async (data, auth) => {
    await payrollService.updateRow(auth, data);
    refresh();
  });
}

export async function removeRowAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, auth) => {
    await payrollService.removeRow(auth, id);
    refresh();
  });
}

export async function deleteMonthAction(input: unknown) {
  return runAction(monthSchema, input, async (data, auth) => {
    await payrollService.deleteMonth(auth, data);
    refresh();
  });
}

export async function closeMonthAction(input: unknown) {
  return runAction(monthSchema, input, async (data, auth) => {
    await payrollService.closeMonth(auth, data);
    refresh();
  });
}

export async function reopenMonthAction(input: unknown) {
  return runAction(monthSchema, input, async (data, auth) => {
    await payrollService.reopenMonth(auth, data);
    refresh();
  });
}

// ───────────── Employees ─────────────

export async function createEmployeeAction(input: unknown) {
  return runAction(employeeSchema, input, async (data, auth) => {
    const employee = await employeesService.createEmployee(auth, data);
    refresh();
    return employee;
  });
}

export async function updateEmployeeAction(input: unknown) {
  return runAction(updateEmployeeSchema, input, async (data, auth) => {
    const change = await employeesService.updateEmployee(auth, data);
    refresh();
    return change;
  });
}

export async function setEmployeeStatusAction(input: unknown) {
  return runAction(employeeStatusSchema, input, async ({ id, status }, auth) => {
    const change = await employeesService.setEmployeeStatus(auth, id, status);
    refresh();
    // The absence form lists working employees only.
    revalidatePath("/absences");
    return change;
  });
}

export async function deleteEmployeeAction(input: unknown) {
  return runAction(idSchema, input, async ({ id }, auth) => {
    await employeesService.deleteEmployee(auth, id);
    refresh();
    revalidatePath("/absences");
  });
}

export async function autoLinkEmployeesAction() {
  return runSimpleAction(async (auth) => {
    const result = await employeesService.autoLinkEmployees(auth);
    refresh();
    return result;
  });
}
