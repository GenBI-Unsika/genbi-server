/*
  Warnings:

  - You are about to drop the `activity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `appsetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `article` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dispensation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dispensationtemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `division` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `emailverificationtoken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `event` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `faculty` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fileobject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `memberpoint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refreshtoken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scholarshipapplication` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `studyprogram` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `teammember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `treasuryentry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `userprofile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `article` DROP FOREIGN KEY `Article_authorId_fkey`;

-- DropForeignKey
ALTER TABLE `dispensation` DROP FOREIGN KEY `Dispensation_reviewedById_fkey`;

-- DropForeignKey
ALTER TABLE `dispensation` DROP FOREIGN KEY `Dispensation_userId_fkey`;

-- DropForeignKey
ALTER TABLE `emailverificationtoken` DROP FOREIGN KEY `EmailVerificationToken_userId_fkey`;

-- DropForeignKey
ALTER TABLE `fileobject` DROP FOREIGN KEY `FileObject_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `refreshtoken` DROP FOREIGN KEY `RefreshToken_userId_fkey`;

-- DropForeignKey
ALTER TABLE `scholarshipapplication` DROP FOREIGN KEY `ScholarshipApplication_createdById_fkey`;

-- DropForeignKey
ALTER TABLE `scholarshipapplication` DROP FOREIGN KEY `ScholarshipApplication_facultyId_fkey`;

-- DropForeignKey
ALTER TABLE `scholarshipapplication` DROP FOREIGN KEY `ScholarshipApplication_reviewedById_fkey`;

-- DropForeignKey
ALTER TABLE `scholarshipapplication` DROP FOREIGN KEY `ScholarshipApplication_studyProgramId_fkey`;

-- DropForeignKey
ALTER TABLE `studyprogram` DROP FOREIGN KEY `StudyProgram_facultyId_fkey`;

-- DropForeignKey
ALTER TABLE `userprofile` DROP FOREIGN KEY `UserProfile_facultyId_fkey`;

-- DropForeignKey
ALTER TABLE `userprofile` DROP FOREIGN KEY `UserProfile_studyProgramId_fkey`;

-- DropForeignKey
ALTER TABLE `userprofile` DROP FOREIGN KEY `UserProfile_userId_fkey`;

-- DropTable
DROP TABLE `activity`;

-- DropTable
DROP TABLE `appsetting`;

-- DropTable
DROP TABLE `article`;

-- DropTable
DROP TABLE `dispensation`;

-- DropTable
DROP TABLE `dispensationtemplate`;

-- DropTable
DROP TABLE `division`;

-- DropTable
DROP TABLE `emailverificationtoken`;

-- DropTable
DROP TABLE `event`;

-- DropTable
DROP TABLE `faculty`;

-- DropTable
DROP TABLE `fileobject`;

-- DropTable
DROP TABLE `memberpoint`;

-- DropTable
DROP TABLE `refreshtoken`;

-- DropTable
DROP TABLE `scholarshipapplication`;

-- DropTable
DROP TABLE `studyprogram`;

-- DropTable
DROP TABLE `teammember`;

-- DropTable
DROP TABLE `treasuryentry`;

-- DropTable
DROP TABLE `user`;

-- DropTable
DROP TABLE `userprofile`;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `google_sub` VARCHAR(191) NULL,
    `role` ENUM('super_admin', 'admin', 'koordinator', 'awardee', 'member', 'alumni') NOT NULL DEFAULT 'member',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_google_sub_key`(`google_sub`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_verification_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_verification_tokens_user_id_key`(`user_id`),
    INDEX `email_verification_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `faculty_id` INTEGER NULL,
    `study_program_id` INTEGER NULL,
    `npm` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `birth_date` DATETIME(3) NULL,
    `semester` INTEGER NULL,
    `motivasi` VARCHAR(191) NULL,
    `bank_name` VARCHAR(191) NULL,
    `bank_account_number` VARCHAR(191) NULL,
    `bank_account_name` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_profiles_user_id_key`(`user_id`),
    INDEX `user_profiles_faculty_id_idx`(`faculty_id`),
    INDEX `user_profiles_study_program_id_idx`(`study_program_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculties` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `faculties_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_programs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `faculty_id` INTEGER NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `degree` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `study_programs_code_key`(`code`),
    INDEX `study_programs_faculty_id_idx`(`faculty_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `jti` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `status` ENUM('active', 'revoked', 'expired') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `replaced_by_jti` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,

    UNIQUE INDEX `refresh_tokens_jti_key`(`jti`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_objects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_by_id` INTEGER NOT NULL,
    `drive_file_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `size_bytes` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `file_objects_drive_file_id_key`(`drive_file_id`),
    INDEX `file_objects_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `divisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `gradient` VARCHAR(191) NULL,
    `bg_light` VARCHAR(191) NULL,
    `text_color` VARCHAR(191) NULL,
    `border_color` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `divisions_key_key`(`key`),
    INDEX `divisions_sort_order_idx`(`sort_order`),
    INDEX `divisions_is_active_sort_order_idx`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_members` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `jabatan` VARCHAR(191) NULL,
    `division_id` INTEGER NOT NULL,
    `photo` VARCHAR(191) NULL,
    `motivasi` VARCHAR(191) NULL,
    `cerita` TEXT NULL,
    `faculty` VARCHAR(191) NULL,
    `major` VARCHAR(191) NULL,
    `cohort` INTEGER NULL,
    `birth_date` DATETIME(3) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `socials` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `team_members_division_id_idx`(`division_id`),
    INDEX `team_members_is_active_sort_order_idx`(`is_active`, `sort_order`),
    INDEX `team_members_birth_date_idx`(`birth_date`),
    UNIQUE INDEX `team_members_name_division_id_key`(`name`, `division_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scholarship_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_by_id` INTEGER NOT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `birth_date` DATETIME(3) NULL,
    `gender` VARCHAR(191) NULL,
    `nik` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `faculty_id` INTEGER NULL,
    `study_program_id` INTEGER NULL,
    `npm` VARCHAR(191) NOT NULL,
    `semester` INTEGER NULL,
    `gpa` DOUBLE NULL,
    `age` INTEGER NULL,
    `know_genbi` VARCHAR(191) NULL,
    `know_desc` VARCHAR(191) NULL,
    `agree` BOOLEAN NOT NULL DEFAULT false,
    `files` JSON NULL,
    `administrasi_status` ENUM('MENUNGGU_VERIFIKASI', 'LOLOS_ADMINISTRASI', 'ADMINISTRASI_DITOLAK') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    `reviewed_by_id` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scholarship_applications_created_by_id_idx`(`created_by_id`),
    INDEX `scholarship_applications_administrasi_status_created_at_idx`(`administrasi_status`, `created_at`),
    INDEX `scholarship_applications_faculty_id_idx`(`faculty_id`),
    INDEX `scholarship_applications_study_program_id_idx`(`study_program_id`),
    UNIQUE INDEX `scholarship_applications_npm_key`(`npm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('MEETING', 'WORKSHOP', 'SEMINAR', 'SOCIAL', 'TRAINING', 'ONLINE', 'OFFLINE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `location` VARCHAR(191) NULL,
    `is_all_day` BOOLEAN NOT NULL DEFAULT false,
    `color` VARCHAR(191) NULL,
    `created_by_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `events_start_date_idx`(`start_date`),
    INDEX `events_is_active_start_date_idx`(`is_active`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `member_points` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `member_id` INTEGER NOT NULL,
    `category` ENUM('KEHADIRAN', 'KONTRIBUSI', 'KEPANITIAAN', 'PRESTASI', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `points` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,
    `event_id` INTEGER NULL,
    `awarded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `awarded_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `member_points_member_id_idx`(`member_id`),
    INDEX `member_points_category_idx`(`category`),
    INDEX `member_points_awarded_at_idx`(`awarded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `treasury_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `member_id` INTEGER NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('LUNAS', 'BELUM_LUNAS', 'SEBAGIAN') NOT NULL DEFAULT 'BELUM_LUNAS',
    `paid_at` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `recorded_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `treasury_entries_member_id_idx`(`member_id`),
    INDEX `treasury_entries_period_idx`(`period`),
    INDEX `treasury_entries_status_idx`(`status`),
    UNIQUE INDEX `treasury_entries_member_id_period_key`(`member_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispensations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `npm` VARCHAR(191) NOT NULL,
    `fakultas` VARCHAR(191) NULL,
    `prodi` VARCHAR(191) NULL,
    `kegiatan` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `alasan` TEXT NULL,
    `status` ENUM('DIAJUKAN', 'DIPROSES', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'DIAJUKAN',
    `reviewed_by_id` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_notes` VARCHAR(191) NULL,
    `file_url` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dispensations_user_id_idx`(`user_id`),
    INDEX `dispensations_status_idx`(`status`),
    INDEX `dispensations_tanggal_idx`(`tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispensation_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `file_name` VARCHAR(191) NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `uploaded_by` VARCHAR(191) NOT NULL,
    `uploaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `division_id` INTEGER NULL,
    `start_date` DATETIME(3) NULL,
    `end_date` DATETIME(3) NULL,
    `location` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `budget` INTEGER NULL,
    `created_by_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `activities_division_id_idx`(`division_id`),
    INDEX `activities_status_idx`(`status`),
    INDEX `activities_start_date_idx`(`start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `articles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `excerpt` TEXT NULL,
    `content` LONGTEXT NULL,
    `cover_image` VARCHAR(191) NULL,
    `author_id` INTEGER NULL,
    `category` VARCHAR(191) NULL,
    `tags` JSON NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `published_at` DATETIME(3) NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `articles_slug_key`(`slug`),
    INDEX `articles_slug_idx`(`slug`),
    INDEX `articles_status_idx`(`status`),
    INDEX `articles_author_id_idx`(`author_id`),
    INDEX `articles_published_at_idx`(`published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_verification_tokens` ADD CONSTRAINT `email_verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_study_program_id_fkey` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `study_programs` ADD CONSTRAINT `study_programs_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_objects` ADD CONSTRAINT `file_objects_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_division_id_fkey` FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_applications` ADD CONSTRAINT `scholarship_applications_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_applications` ADD CONSTRAINT `scholarship_applications_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_applications` ADD CONSTRAINT `scholarship_applications_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scholarship_applications` ADD CONSTRAINT `scholarship_applications_study_program_id_fkey` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_points` ADD CONSTRAINT `member_points_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `team_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `member_points` ADD CONSTRAINT `member_points_awarded_by_id_fkey` FOREIGN KEY (`awarded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_entries` ADD CONSTRAINT `treasury_entries_member_id_fkey` FOREIGN KEY (`member_id`) REFERENCES `team_members`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `treasury_entries` ADD CONSTRAINT `treasury_entries_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensations` ADD CONSTRAINT `dispensations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispensations` ADD CONSTRAINT `dispensations_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_division_id_fkey` FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `articles` ADD CONSTRAINT `articles_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
