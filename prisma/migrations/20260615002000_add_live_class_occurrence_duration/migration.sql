ALTER TABLE `LiveClassSessionOccurrence`
  ADD COLUMN `endedAt` DATETIME(3) NULL,
  ADD COLUMN `durationMinutes` INTEGER NULL,
  ADD COLUMN `completedAt` DATETIME(3) NULL;

CREATE INDEX `LiveClassSessionOccurrence_completed_idx`
  ON `LiveClassSessionOccurrence`(`completedAt`, `durationMinutes`);
