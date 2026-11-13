-- Trigram matching for substring name search («contains» → LIKE '%q%').
-- Must exist before "members_name_normalized_trgm_idx" below.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- DropIndex
DROP INDEX "collections_status_idx";

-- DropIndex
DROP INDEX "exams_date_idx";

-- DropIndex
DROP INDEX "exams_student_id_idx";

-- DropIndex
DROP INDEX "fee_payments_student_id_idx";

-- DropIndex
DROP INDEX "fee_payments_year_month_idx";

-- DropIndex
DROP INDEX "members_name_normalized_idx";

-- DropIndex
DROP INDEX "members_role_idx";

-- DropIndex
DROP INDEX "news_audience_idx";

-- DropIndex
DROP INDEX "payroll_rows_year_month_idx";

-- DropIndex
DROP INDEX "recitations_student_id_date_idx";

-- DropIndex
DROP INDEX "student_profiles_halaqa_id_idx";

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "halaqat" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "payroll_rows" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "pending_columns" ADD COLUMN     "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "places" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "login_throttles" (
    "key" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_throttles_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "login_throttles_updated_at_idx" ON "login_throttles"("updated_at");

-- CreateIndex
CREATE INDEX "collection_lines_student_id_idx" ON "collection_lines"("student_id");

-- CreateIndex
CREATE INDEX "collections_status_sent_at_idx" ON "collections"("status", "sent_at" DESC);

-- CreateIndex
CREATE INDEX "collections_halaqa_id_idx" ON "collections"("halaqa_id");

-- CreateIndex
CREATE INDEX "competition_levels_competition_id_idx" ON "competition_levels"("competition_id");

-- CreateIndex
CREATE INDEX "exams_student_id_date_idx" ON "exams"("student_id", "date" DESC);

-- CreateIndex
CREATE INDEX "exams_halaqa_id_idx" ON "exams"("halaqa_id");

-- CreateIndex
CREATE INDEX "exams_type_date_idx" ON "exams"("type", "date" DESC);

-- CreateIndex
CREATE INDEX "exams_competition_id_idx" ON "exams"("competition_id");

-- CreateIndex
CREATE INDEX "exams_level_id_idx" ON "exams"("level_id");

-- CreateIndex
CREATE INDEX "fee_payments_student_id_year_month_idx" ON "fee_payments"("student_id", "year", "month");

-- CreateIndex
CREATE INDEX "fee_payments_year_month_student_id_idx" ON "fee_payments"("year", "month", "student_id");

-- CreateIndex
CREATE INDEX "fee_payments_collected_by_id_idx" ON "fee_payments"("collected_by_id");

-- CreateIndex
CREATE INDEX "members_role_name_normalized_idx" ON "members"("role", "name_normalized");

-- CreateIndex
CREATE INDEX "members_role_name_idx" ON "members"("role", "name");

-- CreateIndex
CREATE INDEX "members_name_normalized_trgm_idx" ON "members" USING GIN ("name_normalized" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "news_audience_date_idx" ON "news"("audience", "date" DESC);

-- CreateIndex
CREATE INDEX "news_author_id_idx" ON "news"("author_id");

-- CreateIndex
CREATE INDEX "payroll_rows_employee_id_year_month_idx" ON "payroll_rows"("employee_id", "year", "month");

-- CreateIndex
CREATE INDEX "recitations_student_id_date_created_at_idx" ON "recitations"("student_id", "date" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "recitations_student_id_type_date_created_at_idx" ON "recitations"("student_id", "type", "date" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "recitations_date_created_at_idx" ON "recitations"("date" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "student_profiles_halaqa_id_status_idx" ON "student_profiles"("halaqa_id", "status");

-- CreateIndex
CREATE INDEX "student_profiles_fee_category_id_idx" ON "student_profiles"("fee_category_id");

-- CreateIndex
CREATE INDEX "student_profiles_fee_discount_id_idx" ON "student_profiles"("fee_discount_id");

-- CreateIndex
CREATE INDEX "teacher_absences_recorded_by_id_idx" ON "teacher_absences"("recorded_by_id");

-- ─────────────────────────────────────────────────────────────────────
-- Integrity rules enforced by the database itself (Prisma cannot model
-- CHECK constraints). They mirror the Zod validation in src/features/*,
-- so they only fire if a bug or a direct write bypasses the app.
-- ─────────────────────────────────────────────────────────────────────

-- Months are 1–12 everywhere.
ALTER TABLE "payroll_rows"          ADD CONSTRAINT "payroll_rows_month_check"          CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "payroll_closed_months" ADD CONSTRAINT "payroll_closed_months_month_check" CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "teacher_absences"      ADD CONSTRAINT "teacher_absences_month_check"      CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "fee_payments"          ADD CONSTRAINT "fee_payments_month_check"          CHECK ("month" BETWEEN 1 AND 12);
ALTER TABLE "collections"           ADD CONSTRAINT "collections_month_check"           CHECK ("month" BETWEEN 1 AND 12);

-- Quran positions: surah 1–114, ayah ranges start at 1 and never run backwards.
ALTER TABLE "recitations" ADD CONSTRAINT "recitations_position_check"
  CHECK ("surah" BETWEEN 1 AND 114 AND "from_ayah" >= 1 AND "to_ayah" >= "from_ayah");
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_position_check"
  CHECK ("surah" BETWEEN 1 AND 114 AND "from_ayah" >= 1 AND "to_ayah" >= "from_ayah");
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_counts_check"
  CHECK ("mistakes" >= 0 AND "prompts" >= 0 AND "tajweed_mistakes" >= 0 AND "score" >= 0);

-- Ajza are 1–30.
ALTER TABLE "exams" ADD CONSTRAINT "exams_juz_check" CHECK ("juz" IS NULL OR "juz" BETWEEN 1 AND 30);
ALTER TABLE "competition_levels" ADD CONSTRAINT "competition_levels_range_check"
  CHECK ("from_juz" BETWEEN 1 AND 30 AND "to_juz" BETWEEN "from_juz" AND 30 AND "question_count" >= 1);
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_memorized_parts_check"
  CHECK ("memorized_parts" IS NULL OR "memorized_parts" BETWEEN 0 AND 30);

-- Money is never negative; a percentage discount is at most 100%.
ALTER TABLE "fee_payments"     ADD CONSTRAINT "fee_payments_amount_check"     CHECK ("amount" > 0);
ALTER TABLE "fee_categories"   ADD CONSTRAINT "fee_categories_amount_check"   CHECK ("amount" >= 0);
ALTER TABLE "collection_lines" ADD CONSTRAINT "collection_lines_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "fee_discounts"    ADD CONSTRAINT "fee_discounts_value_check"
  CHECK ("value" >= 0 AND ("type" <> 'PERCENT' OR "value" <= 100));
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_fee_check"
  CHECK (("monthly_fee" IS NULL OR "monthly_fee" >= 0) AND ("fee_discount_value" IS NULL OR "fee_discount_value" >= 0));

-- Settings tables hold exactly one row.
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_singleton_check" CHECK ("id" = 1);
ALTER TABLE "exam_settings"    ADD CONSTRAINT "exam_settings_singleton_check"    CHECK ("id" = 1);
