-- AlterTable
ALTER TABLE `teammember` MODIFY `motivasi` VARCHAR(191) NULL,
    MODIFY `cerita` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('MEETING', 'WORKSHOP', 'SEMINAR', 'SOCIAL', 'TRAINING', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `location` VARCHAR(191) NULL,
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `color` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Event_startDate_idx`(`startDate`),
    INDEX `Event_isActive_startDate_idx`(`isActive`, `startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MemberPoint` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `category` ENUM('KEHADIRAN', 'KONTRIBUSI', 'KEPANITIAAN', 'PRESTASI', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `points` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,
    `eventId` VARCHAR(191) NULL,
    `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `awardedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MemberPoint_memberId_idx`(`memberId`),
    INDEX `MemberPoint_category_idx`(`category`),
    INDEX `MemberPoint_awardedAt_idx`(`awardedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TreasuryEntry` (
    `id` VARCHAR(191) NOT NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('LUNAS', 'BELUM_LUNAS', 'SEBAGIAN') NOT NULL DEFAULT 'BELUM_LUNAS',
    `paidAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `recordedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TreasuryEntry_memberId_idx`(`memberId`),
    INDEX `TreasuryEntry_period_idx`(`period`),
    INDEX `TreasuryEntry_status_idx`(`status`),
    UNIQUE INDEX `TreasuryEntry_memberId_period_key`(`memberId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
