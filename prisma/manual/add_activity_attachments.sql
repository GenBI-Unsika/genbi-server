-- Non-destructive patch for drifted databases
-- Adds a JSON column to store activity attachments metadata

ALTER TABLE `activities`
  ADD COLUMN `attachments` JSON NULL AFTER `cover_image`;
