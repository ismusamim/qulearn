-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('FOLLOW_UP', 'PERIODIC', 'MASTERY', 'COMPETITION');

-- CreateTable
CREATE TABLE "exam_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "question_score" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "mistake_penalty" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "prompt_penalty" DECIMAL(6,2) NOT NULL DEFAULT 0.5,
    "tajweed_penalty" DECIMAL(6,2) NOT NULL DEFAULT 0.25,
    "excellent_from" INTEGER NOT NULL DEFAULT 90,
    "very_good_from" INTEGER NOT NULL DEFAULT 80,
    "good_from" INTEGER NOT NULL DEFAULT 65,
    "pass_from" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "exam_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_levels" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "from_juz" INTEGER NOT NULL,
    "to_juz" INTEGER NOT NULL,
    "question_count" INTEGER NOT NULL,

    CONSTRAINT "competition_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "halaqa_id" UUID,
    "type" "ExamType" NOT NULL,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "examiner_id" UUID,
    "examiner_name" TEXT,
    "juz" INTEGER,
    "competition_id" UUID,
    "competition_name" TEXT,
    "level_id" UUID,
    "level_name" TEXT,
    "max_score" DECIMAL(8,2),
    "total" DECIMAL(8,2),
    "grade" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_questions" (
    "id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "surah" SMALLINT NOT NULL,
    "from_ayah" SMALLINT NOT NULL,
    "to_ayah" SMALLINT NOT NULL,
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "prompts" INTEGER NOT NULL DEFAULT 0,
    "tajweed_mistakes" INTEGER NOT NULL DEFAULT 0,
    "score" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exams_student_id_idx" ON "exams"("student_id");

-- CreateIndex
CREATE INDEX "exams_examiner_id_idx" ON "exams"("examiner_id");

-- CreateIndex
CREATE INDEX "exams_date_idx" ON "exams"("date");

-- CreateIndex
CREATE UNIQUE INDEX "exam_questions_exam_id_position_key" ON "exam_questions"("exam_id", "position");

-- AddForeignKey
ALTER TABLE "competition_levels" ADD CONSTRAINT "competition_levels_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_examiner_id_fkey" FOREIGN KEY ("examiner_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_halaqa_id_fkey" FOREIGN KEY ("halaqa_id") REFERENCES "halaqat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "competition_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
