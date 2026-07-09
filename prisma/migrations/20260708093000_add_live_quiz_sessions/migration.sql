CREATE TABLE `QuizLiveSession` (
  `id` VARCHAR(191) NOT NULL,
  `quizId` VARCHAR(191) NOT NULL,
  `teacherUserId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'WAITING',
  `currentQuestionId` VARCHAR(191) NULL,
  `currentQuestionStartedAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NULL,
  `endedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `QuizLiveSession_quizId_status_idx` (`quizId`, `status`),
  INDEX `QuizLiveSession_teacherUserId_status_idx` (`teacherUserId`, `status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `QuizLiveResponse` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `answer` JSON NOT NULL,
  `isCorrect` BOOLEAN NULL,
  `earnedPoints` INTEGER NOT NULL DEFAULT 0,
  `housePointsAwarded` INTEGER NOT NULL DEFAULT 0,
  `answeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `QuizLiveResponse_sessionId_questionId_studentId_key` (`sessionId`, `questionId`, `studentId`),
  INDEX `QuizLiveResponse_studentId_answeredAt_idx` (`studentId`, `answeredAt`),
  INDEX `QuizLiveResponse_questionId_idx` (`questionId`),
  CONSTRAINT `QuizLiveResponse_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `QuizLiveSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
