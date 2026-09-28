CREATE TABLE `CharityPayment` (
 `id` VARCHAR(191) NOT NULL, `sourceKey` VARCHAR(191) NOT NULL, `orderId` VARCHAR(191) NOT NULL,
 `providerSubscriptionId` VARCHAR(191) NULL,
 `gateway` ENUM('STRIPE','PAYPAL','NAYAPAY','BANK_TRANSFER','SCHOLARSHIP','FREE') NOT NULL,
 `status` ENUM('INITIATED','PENDING','SUCCEEDED','FAILED','UNDER_REVIEW','REQUIRES_ACTION','REFUNDED') NOT NULL,
 `amount` DECIMAL(12,2) NOT NULL, `currency` VARCHAR(191) NOT NULL, `paidAt` DATETIME(3) NULL,
 `metadata` JSON NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `CharityPayment_sourceKey_key` (`sourceKey`), INDEX `CharityPayment_orderId_paidAt_idx` (`orderId`,`paidAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
