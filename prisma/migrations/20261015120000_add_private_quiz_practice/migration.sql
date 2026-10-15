CREATE TABLE `QuizPracticeAttempt` (
 `id` VARCHAR(191) NOT NULL, `studentId` VARCHAR(191) NOT NULL, `quizId` VARCHAR(191) NOT NULL,
 `title` VARCHAR(191) NOT NULL, `snapshot` JSON NOT NULL, `answers` JSON NOT NULL,
 `questionIndex` INTEGER NOT NULL DEFAULT 0, `questionStartedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `durationSeconds` INTEGER NOT NULL, `score` INTEGER NOT NULL DEFAULT 0, `correctCount` INTEGER NOT NULL DEFAULT 0,
 `questionCount` INTEGER NOT NULL, `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `finishedAt` DATETIME(3) NULL,
 PRIMARY KEY (`id`), INDEX `QuizPracticeAttempt_studentId_quizId_startedAt_idx` (`studentId`, `quizId`, `startedAt`),
 CONSTRAINT `QuizPracticeAttempt_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `QuizPracticeAttempt_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
