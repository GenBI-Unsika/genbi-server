-- AlterTable
ALTER TABLE `teammember` ADD COLUMN `birthDate` DATETIME(3) NULL,
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `TeamMember_birthDate_idx` ON `TeamMember`(`birthDate`);
