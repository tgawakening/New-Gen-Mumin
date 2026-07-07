CREATE TABLE `MonthlyPaymentRecord` (
  `id` VARCHAR(191) NOT NULL,
  `parentId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `enrollmentId` VARCHAR(191) NULL,
  `orderItemId` VARCHAR(191) NULL,
  `subscriptionId` VARCHAR(191) NULL,
  `monthKey` VARCHAR(191) NOT NULL,
  `billingPeriodStart` DATETIME(3) NOT NULL,
  `billingPeriodEnd` DATETIME(3) NOT NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `status` ENUM('ACTIVE', 'PENDING', 'PAID', 'FAILED', 'ADMIN_ACTIVATED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `method` ENUM('AUTO', 'MANUAL') NOT NULL,
  `gateway` ENUM('STRIPE', 'PAYPAL', 'NAYAPAY', 'BANK_TRANSFER', 'SCHOLARSHIP', 'FREE') NULL,
  `amount` INTEGER NOT NULL,
  `currency` VARCHAR(191) NOT NULL,
  `childName` VARCHAR(191) NOT NULL,
  `programmeTitle` VARCHAR(191) NOT NULL,
  `providerSubscriptionId` VARCHAR(191) NULL,
  `providerInvoiceId` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NULL,
  `activatedAt` DATETIME(3) NULL,
  `activatedByUserId` VARCHAR(191) NULL,
  `pendingNotifiedAt` DATETIME(3) NULL,
  `reminderSentAt` DATETIME(3) NULL,
  `receiptSentAt` DATETIME(3) NULL,
  `failureNotifiedAt` DATETIME(3) NULL,
  `adminNote` LONGTEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `MonthlyPaymentRecord_enrollmentId_monthKey_key`(`enrollmentId`, `monthKey`),
  INDEX `MonthlyPaymentRecord_parentId_monthKey_status_idx`(`parentId`, `monthKey`, `status`),
  INDEX `MonthlyPaymentRecord_studentId_monthKey_idx`(`studentId`, `monthKey`),
  INDEX `MonthlyPaymentRecord_status_dueDate_idx`(`status`, `dueDate`),
  INDEX `MonthlyPaymentRecord_method_status_dueDate_idx`(`method`, `status`, `dueDate`),
  INDEX `MonthlyPaymentRecord_orderItemId_fkey`(`orderItemId`),
  INDEX `MonthlyPaymentRecord_subscriptionId_fkey`(`subscriptionId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MonthlyPaymentRecord` ADD CONSTRAINT `MonthlyPaymentRecord_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ParentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MonthlyPaymentRecord` ADD CONSTRAINT `MonthlyPaymentRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `MonthlyPaymentRecord` ADD CONSTRAINT `MonthlyPaymentRecord_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MonthlyPaymentRecord` ADD CONSTRAINT `MonthlyPaymentRecord_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `OrderItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MonthlyPaymentRecord` ADD CONSTRAINT `MonthlyPaymentRecord_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;