/*
  Baseline migration (squashed).

  Goal:
  - Create the final schema directly using snake_case plural table names.
  - This aligns Prisma migrations with prisma/schema.prisma.

  Target tables:
  activities, activity_registrations, app_settings, articles, dispensations,
  dispensation_templates, divisions, email_verification_tokens, events, faculties,
  file_objects, member_points, page_views, refresh_tokens, roles,
  scholarship_applications, study_programs, subscribers, treasury_entries,
  treasury_transactions, users, user_profiles

  IMPORTANT:
  - If you previously ran the old migrations in a DB, you must reset/baseline that DB.
*/

SET FOREIGN_KEY_CHECKS=0;

-- ROLES
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- USERS
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `email_verified_at` DATETIME(3) NULL,
    `google_sub` VARCHAR(191) NULL,
    `role_id` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_google_sub_key`(`google_sub`),
    INDEX `users_role_id_idx`(`role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- EMAIL VERIFICATION TOKENS
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

-- FACULTIES
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

-- STUDY PROGRAMS
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

    INDEX `study_programs_faculty_id_idx`(`faculty_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- DIVISIONS
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

-- USER PROFILES
CREATE TABLE `user_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `attachments` JSON NULL,
    `name` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `faculty_id` INTEGER NULL,
    `study_program_id` INTEGER NULL,
    `npm` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `birth_date` DATETIME(3) NULL,
    `semester` INTEGER NULL,

    `jabatan` VARCHAR(191) NULL,
    `division_id` INTEGER NULL,
    `socials` JSON NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
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

-- REFRESH TOKENS
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

-- FILE OBJECTS
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

-- APP SETTINGS
CREATE TABLE `app_settings` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- PAGE VIEWS
CREATE TABLE `page_views` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitor_id` VARCHAR(64) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `referrer` VARCHAR(512) NULL,
    `user_agent` VARCHAR(512) NULL,
    `ip_hash` CHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `idx_created_at` ON `page_views`(`created_at`);
CREATE INDEX `idx_path` ON `page_views`(`path`);
CREATE INDEX `idx_visitor_id` ON `page_views`(`visitor_id`);

-- EVENTS
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

-- MEMBER POINTS
CREATE TABLE `member_points` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `category` ENUM('KEHADIRAN', 'KONTRIBUSI', 'KEPANITIAAN', 'PRESTASI', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `points` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,
    `event_id` INTEGER NULL,
    `awarded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `awarded_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `member_points_user_id_idx`(`user_id`),
    INDEX `member_points_category_idx`(`category`),
    INDEX `member_points_awarded_at_idx`(`awarded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- TREASURY ENTRIES
CREATE TABLE `treasury_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('LUNAS', 'BELUM_LUNAS', 'SEBAGIAN') NOT NULL DEFAULT 'BELUM_LUNAS',
    `paid_at` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `recorded_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `treasury_entries_user_id_period_key`(`user_id`, `period`),
    INDEX `treasury_entries_user_id_idx`(`user_id`),
    INDEX `treasury_entries_period_idx`(`period`),
    INDEX `treasury_entries_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- TREASURY TRANSACTIONS
CREATE TABLE `treasury_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `occurred_at` DATETIME(3) NOT NULL,
    `category` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `reference` VARCHAR(191) NULL,
    `created_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `treasury_transactions_occurred_at_idx`(`occurred_at`),
    INDEX `treasury_transactions_type_idx`(`type`),
    INDEX `treasury_transactions_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- DISPENSATION TEMPLATES
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

-- DISPENSATIONS
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

-- ACTIVITIES
CREATE TABLE `activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `cover_image` VARCHAR(191) NULL,
    `theme` VARCHAR(191) NULL,
    `publication_date` DATETIME(3) NULL,
    `attachments` JSON NULL,
    `benefits` JSON NULL,
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

-- ACTIVITY REGISTRATIONS
CREATE TABLE `activity_registrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activity_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `institution` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `registered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `activity_registrations_activity_id_email_key`(`activity_id`, `email`),
    INDEX `activity_registrations_activity_id_idx`(`activity_id`),
    INDEX `activity_registrations_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ARTICLES
CREATE TABLE `articles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `excerpt` TEXT NULL,
    `content` LONGTEXT NULL,
    `cover_image` VARCHAR(191) NULL,
    `attachments` JSON NULL,
    `author_id` INTEGER NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `published_at` DATETIME(3) NULL,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `articles_slug_key`(`slug`),
    INDEX `articles_slug_idx`(`slug`),
    INDEX `articles_status_idx`(`status`),
    INDEX `articles_published_at_idx`(`published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SUBSCRIBERS
CREATE TABLE `subscribers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `subscribed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unsubscribed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subscribers_email_key`(`email`),
    INDEX `subscribers_email_idx`(`email`),
    INDEX `subscribers_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SCHOLARSHIP APPLICATIONS
CREATE TABLE `scholarship_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_by_id` INTEGER NOT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    `year` INTEGER NOT NULL,
    `batch` INTEGER NOT NULL DEFAULT 1,

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
    `know_desc` TEXT NULL,

    `agree` BOOLEAN NOT NULL DEFAULT false,
    `files` JSON NULL,

    `administrasi_status` ENUM('MENUNGGU_VERIFIKASI', 'LOLOS_ADMINISTRASI', 'ADMINISTRASI_DITOLAK') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    `reviewed_by_id` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,

    `interview_status` ENUM('MENUNGGU_JADWAL', 'DIJADWALKAN', 'LOLOS_WAWANCARA', 'GAGAL_WAWANCARA') NOT NULL DEFAULT 'MENUNGGU_JADWAL',
    `interview_date` DATETIME(3) NULL,
    `interview_time` VARCHAR(191) NULL,
    `interview_location` TEXT NULL,
    `interview_notes` TEXT NULL,
    `interview_reviewed_by_id` INTEGER NULL,
    `interview_reviewed_at` DATETIME(3) NULL,

    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `scholarship_applications_created_by_id_year_batch_key`(`created_by_id`, `year`, `batch`),
    UNIQUE INDEX `scholarship_applications_npm_year_batch_key`(`npm`, `year`, `batch`),
    INDEX `scholarship_applications_created_by_id_idx`(`created_by_id`),
    INDEX `scholarship_applications_administrasi_status_created_at_idx`(`administrasi_status`, `created_at`),
    INDEX `scholarship_applications_interview_status_idx`(`interview_status`),
    INDEX `scholarship_applications_faculty_id_idx`(`faculty_id`),
    INDEX `scholarship_applications_study_program_id_idx`(`study_program_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- FOREIGN KEYS
ALTER TABLE `users`
  ADD CONSTRAINT `users_role_id_fkey`
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `email_verification_tokens`
  ADD CONSTRAINT `email_verification_tokens_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `study_programs`
  ADD CONSTRAINT `study_programs_faculty_id_fkey`
  FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_profiles`
  ADD CONSTRAINT `user_profiles_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_profiles`
  ADD CONSTRAINT `user_profiles_faculty_id_fkey`
  FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `user_profiles`
  ADD CONSTRAINT `user_profiles_study_program_id_fkey`
  FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `user_profiles`
  ADD CONSTRAINT `user_profiles_division_id_fkey`
  FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `refresh_tokens_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `file_objects`
  ADD CONSTRAINT `file_objects_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `events`
  ADD CONSTRAINT `events_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `member_points`
  ADD CONSTRAINT `member_points_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `member_points`
  ADD CONSTRAINT `member_points_awarded_by_id_fkey`
  FOREIGN KEY (`awarded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `treasury_entries`
  ADD CONSTRAINT `treasury_entries_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `treasury_entries`
  ADD CONSTRAINT `treasury_entries_recorded_by_id_fkey`
  FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `treasury_transactions`
  ADD CONSTRAINT `treasury_transactions_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `dispensations`
  ADD CONSTRAINT `dispensations_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `dispensations`
  ADD CONSTRAINT `dispensations_reviewed_by_id_fkey`
  FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `activities`
  ADD CONSTRAINT `activities_division_id_fkey`
  FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `activities`
  ADD CONSTRAINT `activities_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `activity_registrations`
  ADD CONSTRAINT `activity_registrations_activity_id_fkey`
  FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `articles`
  ADD CONSTRAINT `articles_author_id_fkey`
  FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `scholarship_applications`
  ADD CONSTRAINT `scholarship_applications_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `scholarship_applications`
  ADD CONSTRAINT `scholarship_applications_reviewed_by_id_fkey`
  FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `scholarship_applications`
  ADD CONSTRAINT `scholarship_applications_interview_reviewed_by_id_fkey`
  FOREIGN KEY (`interview_reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `scholarship_applications`
  ADD CONSTRAINT `scholarship_applications_faculty_id_fkey`
  FOREIGN KEY (`faculty_id`) REFERENCES `faculties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `scholarship_applications`
  ADD CONSTRAINT `scholarship_applications_study_program_id_fkey`
  FOREIGN KEY (`study_program_id`) REFERENCES `study_programs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS=1;
