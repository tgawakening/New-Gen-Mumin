ALTER TABLE `User` MODIFY `role` ENUM('ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'COMMUNICATIONS') NOT NULL;
ALTER TABLE `MonthlyParentFeedback` ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1, ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
ALTER TABLE `Notification` ADD COLUMN `monthlyFeedbackId` VARCHAR(191) NULL, ADD INDEX `Notification_monthlyFeedbackId_idx` (`monthlyFeedbackId`), ADD CONSTRAINT `Notification_monthlyFeedbackId_fkey` FOREIGN KEY (`monthlyFeedbackId`) REFERENCES `MonthlyParentFeedback` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
