-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScholarshipApplication` (
    `id` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `birthDate` DATETIME(3) NULL,
    `gender` VARCHAR(191) NULL,
    `nik` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `faculty` VARCHAR(191) NULL,
    `study` VARCHAR(191) NULL,
    `npm` VARCHAR(191) NOT NULL,
    `semester` INTEGER NULL,
    `gpa` DOUBLE NULL,
    `age` INTEGER NULL,
    `knowGenbi` VARCHAR(191) NULL,
    `knowDesc` VARCHAR(191) NULL,
    `agree` BOOLEAN NOT NULL DEFAULT false,
    `files` JSON NULL,
    `administrasiStatus` ENUM('MENUNGGU_VERIFIKASI', 'LOLOS_ADMINISTRASI', 'ADMINISTRASI_DITOLAK') NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScholarshipApplication_createdById_idx`(`createdById`),
    INDEX `ScholarshipApplication_administrasiStatus_createdAt_idx`(`administrasiStatus`, `createdAt`),
    UNIQUE INDEX `ScholarshipApplication_npm_key`(`npm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ScholarshipApplication` ADD CONSTRAINT `ScholarshipApplication_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScholarshipApplication` ADD CONSTRAINT `ScholarshipApplication_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
