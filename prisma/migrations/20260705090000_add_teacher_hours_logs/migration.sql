CREATE TABLE `TeacherHoursLogEntry` (
  `id` VARCHAR(191) NOT NULL,
  `teacherId` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NULL,
  `occurrenceId` VARCHAR(191) NULL,
  `source` ENUM('TRACKED', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
  `status` ENUM('DRAFT', 'SUBMITTED') NOT NULL DEFAULT 'DRAFT',
  `title` VARCHAR(191) NOT NULL,
  `programTitle` VARCHAR(191) NULL,
  `sessionDate` DATETIME(3) NOT NULL,
  `startTime` VARCHAR(191) NULL,
  `durationMinutes` INTEGER NOT NULL,
  `mode` VARCHAR(191) NOT NULL DEFAULT 'Website / TGA Zoom',
  `notes` LONGTEXT NULL,
  `submittedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `TeacherHoursLogEntry_occurrenceId_key`(`occurrenceId`),
  INDEX `TeacherHoursLogEntry_teacherId_sessionDate_idx`(`teacherId`, `sessionDate`),
  INDEX `TeacherHoursLogEntry_status_submittedAt_idx`(`status`, `submittedAt`),
  INDEX `TeacherHoursLogEntry_scheduleId_fkey`(`scheduleId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TeacherHoursSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `teacherId` VARCHAR(191) NOT NULL,
  `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `monthKey` VARCHAR(191) NOT NULL,
  `totalMinutes` INTEGER NOT NULL,
  `entryCount` INTEGER NOT NULL,
  `note` LONGTEXT NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `TeacherHoursSubmission_teacherId_periodStart_periodEnd_idx`(`teacherId`, `periodStart`, `periodEnd`),
  INDEX `TeacherHoursSubmission_monthKey_submittedAt_idx`(`monthKey`, `submittedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TeacherHoursLogEntry` ADD CONSTRAINT `TeacherHoursLogEntry_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TeacherHoursLogEntry` ADD CONSTRAINT `TeacherHoursLogEntry_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `ClassSchedule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TeacherHoursLogEntry` ADD CONSTRAINT `TeacherHoursLogEntry_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `LiveClassSessionOccurrence`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `TeacherHoursSubmission` ADD CONSTRAINT `TeacherHoursSubmission_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
