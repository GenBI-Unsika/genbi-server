/*
  Warnings:

  - You are about to drop the column `faculty` on the `scholarshipapplication` table. All the data in the column will be lost.
  - You are about to drop the column `study` on the `scholarshipapplication` table. All the data in the column will be lost.
  - You are about to drop the column `faculty` on the `userprofile` table. All the data in the column will be lost.
  - You are about to drop the column `study` on the `userprofile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `scholarshipapplication` DROP COLUMN `faculty`,
    DROP COLUMN `study`,
    ADD COLUMN `facultyId` VARCHAR(191) NULL,
    ADD COLUMN `studyProgramId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `userprofile` DROP COLUMN `faculty`,
    DROP COLUMN `study`,
    ADD COLUMN `facultyId` VARCHAR(191) NULL,
    ADD COLUMN `semester` INTEGER NULL,
    ADD COLUMN `studyProgramId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Faculty` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Faculty_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudyProgram` (
    `id` VARCHAR(191) NOT NULL,
    `facultyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `degree` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudyProgram_code_key`(`code`),
    INDEX `StudyProgram_facultyId_idx`(`facultyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ScholarshipApplication_facultyId_idx` ON `ScholarshipApplication`(`facultyId`);

-- CreateIndex
CREATE INDEX `ScholarshipApplication_studyProgramId_idx` ON `ScholarshipApplication`(`studyProgramId`);

-- CreateIndex
CREATE INDEX `UserProfile_facultyId_idx` ON `UserProfile`(`facultyId`);

-- CreateIndex
CREATE INDEX `UserProfile_studyProgramId_idx` ON `UserProfile`(`studyProgramId`);

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `Faculty`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_studyProgramId_fkey` FOREIGN KEY (`studyProgramId`) REFERENCES `StudyProgram`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudyProgram` ADD CONSTRAINT `StudyProgram_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `Faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScholarshipApplication` ADD CONSTRAINT `ScholarshipApplication_facultyId_fkey` FOREIGN KEY (`facultyId`) REFERENCES `Faculty`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScholarshipApplication` ADD CONSTRAINT `ScholarshipApplication_studyProgramId_fkey` FOREIGN KEY (`studyProgramId`) REFERENCES `StudyProgram`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
