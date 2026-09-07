CREATE TABLE `FardhPrayerDay` (
  `id` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `dayKey` VARCHAR(10) NOT NULL,
  `timezone` VARCHAR(191) NOT NULL,
  `fajr` BOOLEAN NOT NULL DEFAULT false,
  `dhuhr` BOOLEAN NOT NULL DEFAULT false,
  `asr` BOOLEAN NOT NULL DEFAULT false,
  `maghrib` BOOLEAN NOT NULL DEFAULT false,
  `isha` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `FardhPrayerDay_studentId_dayKey_key`(`studentId`, `dayKey`),
  INDEX `FardhPrayerDay_dayKey_idx`(`dayKey`),
  PRIMARY KEY (`id`),
  CONSTRAINT `FardhPrayerDay_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;