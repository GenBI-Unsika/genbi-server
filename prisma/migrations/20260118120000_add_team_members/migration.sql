-- CreateTable
CREATE TABLE `TeamMember` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `jabatan` VARCHAR(191) NULL,
    `division` VARCHAR(191) NOT NULL,
    `photo` VARCHAR(191) NULL,
    `motivasi` TEXT NULL,
    `cerita` TEXT NULL,
    `faculty` VARCHAR(191) NULL,
    `major` VARCHAR(191) NULL,
    `cohort` INTEGER NULL,
    `socials` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeamMember_division_idx`(`division`),
    INDEX `TeamMember_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    UNIQUE INDEX `TeamMember_name_division_key`(`name`, `division`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
