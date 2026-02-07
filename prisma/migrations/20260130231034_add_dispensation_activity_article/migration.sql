-- CreateTable
CREATE TABLE `Dispensation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `npm` VARCHAR(191) NOT NULL,
    `prodi` VARCHAR(191) NULL,
    `kegiatan` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `alasan` TEXT NULL,
    `status` ENUM('DIAJUKAN', 'DIPROSES', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'DIAJUKAN',
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Dispensation_userId_idx`(`userId`),
    INDEX `Dispensation_status_idx`(`status`),
    INDEX `Dispensation_tanggal_idx`(`tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `division` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `location` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PLANNED', 'ONGOING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `budget` INTEGER NULL,
    `createdById` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Activity_division_idx`(`division`),
    INDEX `Activity_status_idx`(`status`),
    INDEX `Activity_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Article` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `excerpt` TEXT NULL,
    `content` LONGTEXT NULL,
    `coverImage` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `tags` JSON NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `viewCount` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Article_slug_key`(`slug`),
    INDEX `Article_slug_idx`(`slug`),
    INDEX `Article_status_idx`(`status`),
    INDEX `Article_authorId_idx`(`authorId`),
    INDEX `Article_publishedAt_idx`(`publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Dispensation` ADD CONSTRAINT `Dispensation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dispensation` ADD CONSTRAINT `Dispensation_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
