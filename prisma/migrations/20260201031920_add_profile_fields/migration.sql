-- AlterTable
ALTER TABLE `dispensation` ADD COLUMN `fakultas` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `userprofile` ADD COLUMN `bankAccountName` VARCHAR(191) NULL,
    ADD COLUMN `bankAccountNumber` VARCHAR(191) NULL,
    ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `motivasi` VARCHAR(191) NULL;
