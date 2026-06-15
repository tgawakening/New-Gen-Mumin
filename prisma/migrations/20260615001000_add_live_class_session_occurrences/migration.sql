CREATE TABLE `LiveClassSessionOccurrence` (
  `id` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NOT NULL,
  `teacherUserId` VARCHAR(191) NULL,
  `meetingId` VARCHAR(191) NULL,
  `occurrenceDate` DATETIME(3) NOT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `source` VARCHAR(191) NOT NULL DEFAULT 'platform',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `LiveClassSessionOccurrence_unique_start`(`scheduleId`, `teacherUserId`, `occurrenceDate`, `source`),
  INDEX `LiveClassSessionOccurrence_schedule_started_idx`(`scheduleId`, `startedAt`),
  INDEX `LiveClassSessionOccurrence_teacher_date_idx`(`teacherUserId`, `occurrenceDate`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LiveClassSessionOccurrence`
  ADD CONSTRAINT `LiveClassSessionOccurrence_scheduleId_fkey`
  FOREIGN KEY (`scheduleId`) REFERENCES `ClassSchedule`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
