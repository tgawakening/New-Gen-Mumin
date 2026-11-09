ALTER TABLE `ZoomAttendanceInterval`
  ADD COLUMN `parentId` VARCHAR(191) NULL,
  ADD COLUMN `evidenceSource` VARCHAR(191) NOT NULL DEFAULT 'legacy',
  ADD COLUMN `sessionStartedAt` DATETIME(3) NULL,
  ADD COLUMN `sessionEndedAt` DATETIME(3) NULL,
  ADD INDEX `ZoomAttendanceInterval_parentId_joinedAt_idx` (`parentId`, `joinedAt`),
  ADD INDEX `ZoomAttendanceInterval_meetingUuid_joinedAt_idx` (`meetingUuid`, `joinedAt`);

ALTER TABLE `ZoomAttendanceInterval` ALTER COLUMN `evidenceSource` SET DEFAULT 'webhook';

CREATE TABLE `ZoomAttendanceWork` (
  `id` VARCHAR(191) NOT NULL,
  `eventKey` VARCHAR(64) NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `meetingId` VARCHAR(191) NOT NULL,
  `meetingUuid` VARCHAR(191) NULL,
  `payload` JSON NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lockedAt` DATETIME(3) NULL,
  `lockToken` VARCHAR(191) NULL,
  `lastError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ZoomAttendanceWork_eventKey_key` (`eventKey`),
  INDEX `ZoomAttendanceWork_status_availableAt_idx` (`status`, `availableAt`),
  INDEX `ZoomAttendanceWork_meetingUuid_kind_idx` (`meetingUuid`, `kind`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
