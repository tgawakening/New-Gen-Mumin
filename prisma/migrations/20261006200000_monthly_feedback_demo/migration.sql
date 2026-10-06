CREATE TABLE `MonthlyFeedbackDemo` (
 `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `month` VARCHAR(7) NOT NULL, `version` INTEGER NOT NULL DEFAULT 1, `details` JSON NOT NULL, `answers` JSON NOT NULL, `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `MonthlyFeedbackDemo_userId_month_key`(`userId`, `month`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
