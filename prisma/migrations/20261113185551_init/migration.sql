-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'TEACHER', 'STUDENT', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('MOSQUE', 'DAR');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('CLOCK', 'PRAYER');

-- CreateEnum
CREATE TYPE "StudentCategory" AS ENUM ('CHILD', 'ADULT');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'DROPPED');

-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT');

-- CreateEnum
CREATE TYPE "RecitationType" AS ENUM ('HIFZ', 'REVIEW', 'CONSOLIDATION');

-- CreateEnum
CREATE TYPE "NewsAudience" AS ENUM ('ALL', 'ADMIN', 'SUPERVISOR', 'TEACHER', 'STUDENT', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "CustomFieldKind" AS ENUM ('STUDENTS', 'TEACHERS');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'TEXTAREA');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'STOPPED');

-- CreateEnum
CREATE TYPE "AbsencePermission" AS ENUM ('WITH_PERMISSION', 'WITHOUT_PERMISSION');

-- CreateEnum
CREATE TYPE "AbsenceProof" AS ENUM ('BALANCE', 'PROVEN');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'SENT', 'RETURNED', 'DONE');

-- CreateEnum
CREATE TYPE "CollectionLineState" AS ENUM ('PENDING', 'OK', 'ISSUE');

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "password_hash" TEXT,
    "photo" TEXT,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "member_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "Role" NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role","permission")
);

-- CreateTable
CREATE TABLE "member_permissions" (
    "member_id" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "member_permissions_pkey" PRIMARY KEY ("member_id","permission")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "member_id" UUID NOT NULL,
    "category" "StudentCategory" NOT NULL DEFAULT 'CHILD',
    "halaqa_id" UUID,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "status_date" DATE,
    "national_id" TEXT,
    "birth_date" DATE,
    "birth_year" INTEGER,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "study" TEXT NOT NULL DEFAULT '',
    "grade" TEXT NOT NULL DEFAULT '',
    "guardian_name" TEXT NOT NULL DEFAULT '',
    "guardian_job" TEXT NOT NULL DEFAULT '',
    "guardian_phone" TEXT NOT NULL DEFAULT '',
    "guardian_whatsapp" TEXT NOT NULL DEFAULT '',
    "guardian_relation" TEXT NOT NULL DEFAULT '',
    "guardian_relation_other" TEXT NOT NULL DEFAULT '',
    "marital_status" TEXT NOT NULL DEFAULT '',
    "qualification" TEXT NOT NULL DEFAULT '',
    "qualification_status" TEXT NOT NULL DEFAULT '',
    "job" TEXT NOT NULL DEFAULT '',
    "availability" TEXT NOT NULL DEFAULT '',
    "test_reading" TEXT NOT NULL DEFAULT '',
    "test_tajweed" TEXT NOT NULL DEFAULT '',
    "test_hifz" TEXT NOT NULL DEFAULT '',
    "join_date" DATE,
    "pledge_signed" BOOLEAN NOT NULL DEFAULT false,
    "monthly_fee" DECIMAL(12,2),
    "fee_category_id" UUID,
    "fee_discount_id" UUID,
    "fee_discount_value" DECIMAL(12,2),
    "fee_discount_type" "DiscountType",

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "member_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL DEFAULT '',
    "birth_date" DATE,
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "emergency_contact" TEXT NOT NULL DEFAULT '',
    "employee_no" TEXT NOT NULL DEFAULT '',
    "join_date" DATE,
    "contract_type" TEXT NOT NULL DEFAULT '',
    "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthly_pay" DECIMAL(12,2),
    "admin_note" TEXT NOT NULL DEFAULT '',
    "qualification" TEXT NOT NULL DEFAULT '',
    "riwaya" TEXT NOT NULL DEFAULT '',
    "ijaza" TEXT NOT NULL DEFAULT '',
    "sanad" TEXT NOT NULL DEFAULT '',
    "memorized_parts" INTEGER,
    "experience_years" INTEGER,
    "specialty" TEXT NOT NULL DEFAULT '',
    "courses" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlaceType" NOT NULL DEFAULT 'MOSQUE',
    "address" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "halaqat" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "teacher_id" UUID,
    "supervisor_id" UUID,
    "place_id" UUID,
    "schedule_mode" "ScheduleMode",
    "start_time" TEXT,
    "end_time" TEXT,
    "start_prayer" TEXT,
    "end_prayer" TEXT,

    CONSTRAINT "halaqat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "recorded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recitations" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "RecitationType" NOT NULL,
    "surah" SMALLINT NOT NULL,
    "from_ayah" SMALLINT NOT NULL,
    "to_ayah" SMALLINT NOT NULL,
    "grade" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "recorded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "audience" "NewsAudience" NOT NULL DEFAULT 'ALL',
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" UUID,
    "author_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "kind" "CustomFieldKind" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("kind","key")
);

-- CreateTable
CREATE TABLE "pending_columns" (
    "id" UUID NOT NULL,
    "kind" "CustomFieldKind" NOT NULL,
    "header" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '[]',
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "absence_with_permission" DECIMAL(12,2) NOT NULL DEFAULT 20,
    "absence_no_permission" DECIMAL(12,2) NOT NULL DEFAULT 30,
    "meeting_with_permission" DECIMAL(12,2) NOT NULL DEFAULT 50,
    "meeting_no_permission" DECIMAL(12,2) NOT NULL DEFAULT 70,
    "round_to" INTEGER NOT NULL DEFAULT 5,
    "leave_days_3" INTEGER NOT NULL DEFAULT 10,
    "leave_days_6" INTEGER NOT NULL DEFAULT 21,
    "default_hours" DECIMAL(8,2) NOT NULL DEFAULT 26,
    "pin_hash" TEXT,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "job_title" TEXT,
    "work_system" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "basic" DECIMAL(12,2),
    "rate" DECIMAL(12,2),
    "incentive" DECIMAL(12,2),
    "transport" DECIMAL(12,2),
    "hours" DECIMAL(8,2),
    "place" TEXT,
    "note" TEXT,
    "member_id" UUID,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_rows" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" TEXT,
    "job_title" TEXT,
    "base_hours" DECIMAL(8,2),
    "extra_hours" DECIMAL(8,2),
    "exceptional_hours" DECIMAL(8,2),
    "absent_with_permission" DECIMAL(8,2),
    "absent_no_permission" DECIMAL(8,2),
    "meetings_with_permission" DECIMAL(8,2),
    "meetings_no_permission" DECIMAL(8,2),
    "deduction_test" DECIMAL(12,2),
    "deduction_recitation" DECIMAL(12,2),
    "deduction_books" DECIMAL(12,2),
    "basic" DECIMAL(12,2),
    "rate" DECIMAL(12,2),
    "incentive" DECIMAL(12,2),
    "transport" DECIMAL(12,2),
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "payroll_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_closed_months" (
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,

    CONSTRAINT "payroll_closed_months_pkey" PRIMARY KEY ("year","month")
);

-- CreateTable
CREATE TABLE "teacher_absences" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "employee_id" UUID NOT NULL,
    "name" TEXT,
    "place" TEXT,
    "permission" "AbsencePermission",
    "reason" TEXT,
    "proof" "AbsenceProof",
    "note" TEXT,
    "recorded_by_id" UUID,
    "recorded_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "default_for" "StudentCategory",
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_discounts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "per_student" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fee_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_payments" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE,
    "collected_by_id" UUID,
    "collected_by_name" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "teacher_name" TEXT,
    "halaqa_id" UUID,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "accountant_note" TEXT NOT NULL DEFAULT '',
    "sent_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_lines" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "state" "CollectionLineState" NOT NULL DEFAULT 'PENDING',
    "accountant_note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "collection_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "members_role_idx" ON "members"("role");

-- CreateIndex
CREATE INDEX "members_name_normalized_idx" ON "members"("name_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_member_id_idx" ON "sessions"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_national_id_key" ON "student_profiles"("national_id");

-- CreateIndex
CREATE INDEX "student_profiles_halaqa_id_idx" ON "student_profiles"("halaqa_id");

-- CreateIndex
CREATE INDEX "student_profiles_status_idx" ON "student_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "places_name_key" ON "places"("name");

-- CreateIndex
CREATE INDEX "halaqat_teacher_id_idx" ON "halaqat"("teacher_id");

-- CreateIndex
CREATE INDEX "halaqat_supervisor_id_idx" ON "halaqat"("supervisor_id");

-- CreateIndex
CREATE INDEX "halaqat_place_id_idx" ON "halaqat"("place_id");

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_student_id_date_key" ON "attendance"("student_id", "date");

-- CreateIndex
CREATE INDEX "recitations_student_id_date_idx" ON "recitations"("student_id", "date" DESC);

-- CreateIndex
CREATE INDEX "news_audience_idx" ON "news"("audience");

-- CreateIndex
CREATE UNIQUE INDEX "employees_member_id_key" ON "employees"("member_id");

-- CreateIndex
CREATE INDEX "payroll_rows_year_month_idx" ON "payroll_rows"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_rows_year_month_employee_id_key" ON "payroll_rows"("year", "month", "employee_id");

-- CreateIndex
CREATE INDEX "teacher_absences_year_month_idx" ON "teacher_absences"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_absences_employee_id_date_key" ON "teacher_absences"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "fee_categories_default_for_key" ON "fee_categories"("default_for");

-- CreateIndex
CREATE INDEX "fee_payments_student_id_idx" ON "fee_payments"("student_id");

-- CreateIndex
CREATE INDEX "fee_payments_year_month_idx" ON "fee_payments"("year", "month");

-- CreateIndex
CREATE INDEX "collections_status_idx" ON "collections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "collections_teacher_id_halaqa_id_year_month_key" ON "collections"("teacher_id", "halaqa_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "collection_lines_collection_id_student_id_key" ON "collection_lines"("collection_id", "student_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_permissions" ADD CONSTRAINT "member_permissions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_fee_category_id_fkey" FOREIGN KEY ("fee_category_id") REFERENCES "fee_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_fee_discount_id_fkey" FOREIGN KEY ("fee_discount_id") REFERENCES "fee_discounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halaqat" ADD CONSTRAINT "halaqat_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halaqat" ADD CONSTRAINT "halaqat_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "halaqat" ADD CONSTRAINT "halaqat_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recitations" ADD CONSTRAINT "recitations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recitations" ADD CONSTRAINT "recitations_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_rows" ADD CONSTRAINT "payroll_rows_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_absences" ADD CONSTRAINT "teacher_absences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_absences" ADD CONSTRAINT "teacher_absences_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_lines" ADD CONSTRAINT "collection_lines_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_lines" ADD CONSTRAINT "collection_lines_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
