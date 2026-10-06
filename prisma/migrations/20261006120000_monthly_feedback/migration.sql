CREATE TABLE `MonthlyParentFeedback` (
 `id` VARCHAR(191) NOT NULL,
 `studentId` VARCHAR(191) NOT NULL,
 `submittedById` VARCHAR(191) NOT NULL,
 `month` VARCHAR(7) NOT NULL,
 `schemaVersion` INTEGER NOT NULL DEFAULT 1,
 `details` JSON NOT NULL,
 `answers` JSON NOT NULL,
 `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE INDEX `MonthlyParentFeedback_studentId_month_key` (`studentId`, `month`),
 INDEX `MonthlyParentFeedback_month_submittedAt_idx` (`month`, `submittedAt`),
 INDEX `MonthlyParentFeedback_submittedById_idx` (`submittedById`),
 PRIMARY KEY (`id`),
 CONSTRAINT `MonthlyParentFeedback_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `MonthlyParentFeedback_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
