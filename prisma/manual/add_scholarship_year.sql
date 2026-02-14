-- Migration: Add year field to scholarship_applications for period tracking
-- Run this BEFORE running `npx prisma migrate dev`

-- Step 1: Add the year column with a default value
ALTER TABLE `scholarship_applications` ADD COLUMN `year` INT NOT NULL DEFAULT 2025;

-- Step 2: Update existing records to use the year from submitted_at
UPDATE `scholarship_applications` 
SET `year` = YEAR(`submitted_at`) 
WHERE `year` = 2025;

-- Step 3: Drop old unique constraints
ALTER TABLE `scholarship_applications` DROP INDEX `scholarship_applications_created_by_id_batch_key`;
ALTER TABLE `scholarship_applications` DROP INDEX `scholarship_applications_npm_batch_key`;

-- Step 4: Add new unique constraints with year
ALTER TABLE `scholarship_applications` ADD UNIQUE INDEX `scholarship_applications_created_by_id_year_batch_key` (`created_by_id`, `year`, `batch`);
ALTER TABLE `scholarship_applications` ADD UNIQUE INDEX `scholarship_applications_npm_year_batch_key` (`npm`, `year`, `batch`);

-- Step 5: Add index on year for query performance (optional)
ALTER TABLE `scholarship_applications` ADD INDEX `idx_year` (`year`);

-- Step 6: Remove the default value after migration
ALTER TABLE `scholarship_applications` ALTER COLUMN `year` DROP DEFAULT;
