CREATE TABLE `LiveClassRecording` (
  `id` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NOT NULL,
  `recordingFileId` VARCHAR(191) NULL,
  `meetingId` VARCHAR(191) NULL,
  `topic` VARCHAR(191) NULL,
  `fileType` VARCHAR(191) NULL,
  `playUrl` TEXT NOT NULL,
  `downloadUrl` TEXT NULL,
  `recordingStart` DATETIME(3) NULL,
  `recordingEnd` DATETIME(3) NULL,
  `fileSize` BIGINT NULL,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `LiveClassRecording_recordingFileId_key`(`recordingFileId`),
  INDEX `LiveClassRecording_scheduleId_availableAt_idx`(`scheduleId`, `availableAt`),
  INDEX `LiveClassRecording_deletedAt_availableAt_idx`(`deletedAt`, `availableAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LiveClassRecording`
  ADD CONSTRAINT `LiveClassRecording_scheduleId_fkey`
  FOREIGN KEY (`scheduleId`) REFERENCES `ClassSchedule`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
