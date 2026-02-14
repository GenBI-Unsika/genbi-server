-- Backfill scholarship_applications.year for existing rows, then enforce NOT NULL

UPDATE `scholarship_applications`
SET `year` = YEAR(`submitted_at`)
WHERE `year` IS NULL;

ALTER TABLE `scholarship_applications`
  MODIFY COLUMN `year` INT NOT NULL;
