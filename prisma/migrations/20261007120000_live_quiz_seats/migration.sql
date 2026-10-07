CREATE TABLE `QuizLiveSeat` (
 `id` VARCHAR(191) NOT NULL, `sessionId` VARCHAR(191) NOT NULL, `studentId` VARCHAR(191) NOT NULL, `joinedAt` DATETIME(3) NULL, `lastSeenAt` DATETIME(3) NULL,
 UNIQUE INDEX `QuizLiveSeat_sessionId_studentId_key`(`sessionId`,`studentId`), INDEX `QuizLiveSeat_studentId_sessionId_idx`(`studentId`,`sessionId`), PRIMARY KEY (`id`),
 CONSTRAINT `QuizLiveSeat_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `QuizLiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `QuizLiveSeat_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `QuizLiveSession_status_updatedAt_idx` ON `QuizLiveSession`(`status`,`updatedAt`);
