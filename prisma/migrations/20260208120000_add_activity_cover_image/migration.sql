-- Add cover_image to activities
ALTER TABLE `activities`
  ADD COLUMN `cover_image` VARCHAR(191) NULL AFTER `description`;
