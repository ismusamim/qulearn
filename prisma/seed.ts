/**
 * Demo data for a fresh database: one account of each kind, a place, a halaqa
 * and three students. Safe to re-run: it does nothing once any member exists.
 *
 *   npm run db:seed
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient, type Role } from "../src/generated/prisma/client";
import { normalizeArabic } from "../src/lib/arabic";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function member(role: Role, name: string, password: string) {
  return db.member.create({
    data: { role, name, nameNormalized: normalizeArabic(name), passwordHash: await bcrypt.hash(password, 10) },
  });
}

async function main() {
  if ((await db.member.count()) > 0) {
    console.log("Database already has members; nothing to seed.");
    return;
  }

  await member("ADMIN", "المدير", "1234");
  await member("ACCOUNTANT", "المحاسب سعيد", "0000");
  const supervisor = await member("SUPERVISOR", "المشرف خالد", "0000");
  const teacher = await member("TEACHER", "الشيخ أحمد", "0000");
  await db.teacherProfile.create({ data: { memberId: teacher.id } });

  const place = await db.place.create({ data: { name: "المسجد الكبير", type: "MOSQUE" } });
  const halaqa = await db.halaqa.create({
    data: {
      teacherId: teacher.id,
      supervisorId: supervisor.id,
      placeId: place.id,
      scheduleMode: "PRAYER",
      startPrayer: "العصر",
      endPrayer: "المغرب",
    },
  });

  for (const name of ["عبد الله", "محمد", "يوسف"]) {
    const student = await member("STUDENT", name, "0000");
    await db.studentProfile.create({ data: { memberId: student.id, category: "CHILD", halaqaId: halaqa.id } });
  }

  await db.payrollSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  await db.examSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const discounts = [
    { name: "أبناء موظفي التحفيظ", value: 0, perStudent: false },
    { name: "أبناء موظفي الجمعية", value: 0, perStudent: false },
    { name: "أيتام", value: 100, perStudent: false },
    { name: "حالات خاصة", value: 0, perStudent: true },
  ];
  await db.feeDiscount.createMany({
    data: discounts.map((d, i) => ({ ...d, type: "PERCENT" as const, sortOrder: i })),
  });

  console.log("Seeded. Log in as «المدير» with password 1234 (others: 0000).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
