ALTER TABLE `LiveClassRecording`
  ADD COLUMN `driveUploadSessionUrl` TEXT NULL,
  ADD COLUMN `driveUploadOffset` BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN `driveUploadTotal` BIGINT NULL,
  ADD COLUMN `driveUploadUpdatedAt` DATETIME(3) NULL,
  ADD COLUMN `driveUploadFileName` VARCHAR(191) NULL;
