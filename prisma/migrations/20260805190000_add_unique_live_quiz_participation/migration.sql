CREATE TABLE `QuizLiveParticipation` (
  `id` VARCHAR(191) NOT NULL,
  `quizId` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `QuizLiveParticipation_quizId_studentId_key`(`quizId`, `studentId`),
  INDEX `QuizLiveParticipation_sessionId_idx`(`sessionId`),
  INDEX `QuizLiveParticipation_studentId_idx`(`studentId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;