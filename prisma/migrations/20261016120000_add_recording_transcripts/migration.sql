CREATE TABLE `RecordingTranscript` (
 `id` VARCHAR(191) NOT NULL, `recordingId` VARCHAR(191) NOT NULL,
 `status` VARCHAR(191) NOT NULL DEFAULT 'EMPTY', `provider` VARCHAR(191) NOT NULL DEFAULT 'zoom',
 `providerJobId` VARCHAR(191) NULL, `segments` JSON NULL, `speakerNames` JSON NULL, `error` TEXT NULL,
 `mediaTokenHash` VARCHAR(191) NULL, `mediaExpiresAt` DATETIME(3) NULL, `lastCheckedAt` DATETIME(3) NULL,
 `requestedByUserId` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`), UNIQUE INDEX `RecordingTranscript_recordingId_key` (`recordingId`),
 CONSTRAINT `RecordingTranscript_recordingId_fkey` FOREIGN KEY (`recordingId`) REFERENCES `LiveClassRecording` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
