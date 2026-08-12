ALTER TABLE `AttendanceRecord`
  ADD COLUMN `joinedAt` DATETIME(3) NULL,
  ADD COLUMN `leftAt` DATETIME(3) NULL,
  ADD COLUMN `durationMinutes` INTEGER NULL,
  ADD COLUMN `source` VARCHAR(191) NULL DEFAULT 'manual';

CREATE TABLE `ZoomJoinIntent` (
  `id` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `clickedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ZoomJoinIntent_scheduleId_clickedAt_idx` (`scheduleId`, `clickedAt`),
  INDEX `ZoomJoinIntent_studentId_clickedAt_idx` (`studentId`, `clickedAt`),
  INDEX `ZoomJoinIntent_userId_clickedAt_idx` (`userId`, `clickedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ZoomAttendanceInterval` (
  `id` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NULL,
  `meetingId` VARCHAR(191) NOT NULL,
  `meetingUuid` VARCHAR(191) NULL,
  `zoomParticipantId` VARCHAR(191) NULL,
  `participantEmail` VARCHAR(191) NULL,
  `participantName` VARCHAR(191) NULL,
  `joinedAt` DATETIME(3) NOT NULL,
  `leftAt` DATETIME(3) NULL,
  `durationSeconds` INTEGER NOT NULL DEFAULT 0,
  `matchMethod` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ZoomAttendance_meeting_participant_joined_key` (`scheduleId`, `meetingId`, `zoomParticipantId`, `joinedAt`),
  INDEX `ZoomAttendanceInterval_scheduleId_joinedAt_idx` (`scheduleId`, `joinedAt`),
  INDEX `ZoomAttendanceInterval_studentId_joinedAt_idx` (`studentId`, `joinedAt`),
  INDEX `ZoomAttendanceInterval_meetingId_joinedAt_idx` (`meetingId`, `joinedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ZoomJoinIntent` ADD CONSTRAINT `ZoomJoinIntent_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `ClassSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ZoomJoinIntent` ADD CONSTRAINT `ZoomJoinIntent_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ZoomJoinIntent` ADD CONSTRAINT `ZoomJoinIntent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ZoomAttendanceInterval` ADD CONSTRAINT `ZoomAttendanceInterval_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `ClassSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ZoomAttendanceInterval` ADD CONSTRAINT `ZoomAttendanceInterval_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
