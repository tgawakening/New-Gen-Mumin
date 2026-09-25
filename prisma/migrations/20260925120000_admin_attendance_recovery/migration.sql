CREATE TABLE `AdminAttendanceRecovery` (
  `id` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `fromDay` VARCHAR(10) NOT NULL,
  `toDay` VARCHAR(10) NOT NULL,
  `parentName` VARCHAR(191) NOT NULL,
  `note` TEXT NOT NULL,
  `missedCount` INTEGER NOT NULL DEFAULT 0,
  `teacherId` VARCHAR(191) NULL,
  `sessions` JSON NOT NULL,
  `revisions` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `AdminAttendanceRecovery_studentId_fromDay_toDay_key` (`studentId`, `fromDay`, `toDay`),
  INDEX `AdminAttendanceRecovery_studentId_idx` (`studentId`),
  CONSTRAINT `AdminAttendanceRecovery_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
