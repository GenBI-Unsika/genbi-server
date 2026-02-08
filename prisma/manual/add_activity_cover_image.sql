-- Add cover_image column used by Prisma Activity.coverImage
-- Safe targeted change (no drops)
ALTER TABLE `activities`
  ADD COLUMN `cover_image` VARCHAR(191) NULL AFTER `description`;
