-- CreateTable
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

-- AddForeignKey
ALTER TABLE `treasury_transactions` ADD CONSTRAINT `treasury_transactions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
