CREATE TABLE `AttendanceConfirmationAudit` (
  `id` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `parentUserId` VARCHAR(191) NOT NULL,
  `requirementKey` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NOT NULL,
  `attendanceDay` VARCHAR(10) NOT NULL,
  `previousStatus` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `pointsDelta` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AttendanceConfirmationAudit_studentId_createdAt_idx` (`studentId`, `createdAt`),
  INDEX `AttendanceConfirmationAudit_requirementKey_createdAt_idx` (`requirementKey`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
