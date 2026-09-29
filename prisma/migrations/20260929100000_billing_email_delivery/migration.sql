ALTER TABLE `MonthlyPaymentRecord` ADD COLUMN `billingKey` VARCHAR(191) NULL, MODIFY `amount` DOUBLE NOT NULL;
CREATE UNIQUE INDEX `MonthlyPaymentRecord_billingKey_key` ON `MonthlyPaymentRecord`(`billingKey`);
CREATE TABLE `BillingEmailJob` (
 `id` VARCHAR(191) NOT NULL, `key` VARCHAR(191) NOT NULL, `kind` VARCHAR(191) NOT NULL,
 `toEmail` VARCHAR(191) NOT NULL, `recordId` VARCHAR(191) NULL, `payload` JSON NOT NULL,
 `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING', `attempts` INTEGER NOT NULL DEFAULT 0,
 `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `lockToken` VARCHAR(191) NULL,
 `lockedUntil` DATETIME(3) NULL, `sentAt` DATETIME(3) NULL, `lastError` TEXT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `BillingEmailJob_key_key` (`key`), INDEX `BillingEmailJob_status_nextAttemptAt_idx` (`status`, `nextAttemptAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
