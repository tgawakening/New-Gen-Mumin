-- Gen Mu'min community, missions, feedback, moderation, and projects tables.
-- Run this against the existing MySQL database before deploying the new pages.

CREATE TABLE IF NOT EXISTS `House` (
  `id` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `virtue` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `color` VARCHAR(191) NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `House_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `HouseMembership` (
  `id` VARCHAR(191) NOT NULL,
  `houseId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HouseMembership_studentId_key`(`studentId`),
  INDEX `HouseMembership_houseId_idx`(`houseId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `HouseMembership_houseId_fkey` FOREIGN KEY (`houseId`) REFERENCES `House`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `HouseMembership_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `HousePointLedger` (
  `id` VARCHAR(191) NOT NULL,
  `houseId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `points` INTEGER NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `sourceType` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NULL,
  `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `HousePointLedger_houseId_awardedAt_idx`(`houseId`, `awardedAt`),
  INDEX `HousePointLedger_studentId_awardedAt_idx`(`studentId`, `awardedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `HousePointLedger_houseId_fkey` FOREIGN KEY (`houseId`) REFERENCES `House`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `HousePointLedger_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Mission` (
  `id` VARCHAR(191) NOT NULL,
  `programId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `kind` ENUM('DAILY','WEEKLY','TEAM_BATTLE','REFLECTION') NOT NULL DEFAULT 'DAILY',
  `status` ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `opensAt` DATETIME(3) NULL,
  `closesAt` DATETIME(3) NULL,
  `basePoints` INTEGER NOT NULL DEFAULT 25,
  `timeLimitSeconds` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Mission_programId_status_idx`(`programId`, `status`),
  INDEX `Mission_status_opensAt_closesAt_idx`(`status`, `opensAt`, `closesAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Mission_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MissionQuestion` (
  `id` VARCHAR(191) NOT NULL,
  `missionId` VARCHAR(191) NOT NULL,
  `prompt` VARCHAR(191) NOT NULL,
  `type` ENUM('MCQ','TRUE_FALSE','FILL_IN_BLANK','SHORT_REFLECTION') NOT NULL DEFAULT 'MCQ',
  `points` INTEGER NOT NULL DEFAULT 1,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `answerKey` JSON NULL,
  `meta` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `MissionQuestion_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MissionAttempt` (
  `id` VARCHAR(191) NOT NULL,
  `missionId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `attemptNumber` INTEGER NOT NULL DEFAULT 1,
  `score` INTEGER NULL,
  `pointsAwarded` INTEGER NOT NULL DEFAULT 0,
  `reflection` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `MissionAttempt_studentId_submittedAt_idx`(`studentId`, `submittedAt`),
  INDEX `MissionAttempt_missionId_studentId_idx`(`missionId`, `studentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MissionAttempt_missionId_fkey` FOREIGN KEY (`missionId`) REFERENCES `Mission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MissionAttempt_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MissionAnswer` (
  `id` VARCHAR(191) NOT NULL,
  `attemptId` VARCHAR(191) NOT NULL,
  `questionId` VARCHAR(191) NOT NULL,
  `answer` JSON NOT NULL,
  `isCorrect` BOOLEAN NULL,
  `earnedPoints` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `MissionAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `MissionAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MissionAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `MissionQuestion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `WeeklyFeedbackResponse` (
  `id` VARCHAR(191) NOT NULL,
  `audience` ENUM('STUDENT','PARENT','TEACHER') NOT NULL,
  `studentId` VARCHAR(191) NULL,
  `teacherUserId` VARCHAR(191) NULL,
  `submittedById` VARCHAR(191) NOT NULL,
  `weekLabel` VARCHAR(191) NOT NULL,
  `moodRating` INTEGER NULL,
  `confidence` INTEGER NULL,
  `workload` INTEGER NULL,
  `wins` LONGTEXT NULL,
  `concerns` LONGTEXT NULL,
  `supportNeeded` LONGTEXT NULL,
  `rawPayload` JSON NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `WeeklyFeedbackResponse_studentId_audience_submittedAt_idx`(`studentId`, `audience`, `submittedAt`),
  INDEX `WeeklyFeedbackResponse_submittedById_submittedAt_idx`(`submittedById`, `submittedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WeeklyFeedbackResponse_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `WeeklyFeedbackResponse_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CommunityRoom` (
  `id` VARCHAR(191) NOT NULL,
  `programId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `type` ENUM('CLASS_ROOM','BOYS_CIRCLE','GIRLS_CIRCLE','PROJECT_TEAM','MENTOR_QA','ANNOUNCEMENT','PARENT_NOTICE') NOT NULL,
  `visibility` ENUM('STUDENTS','PARENTS','TEACHERS','MIXED_APPROVED') NOT NULL DEFAULT 'STUDENTS',
  `ageBand` VARCHAR(191) NULL,
  `genderScope` VARCHAR(191) NULL,
  `isReadOnly` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CommunityRoom_programId_type_isActive_idx`(`programId`, `type`, `isActive`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CommunityRoom_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CommunityMembership` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `mutedUntil` DATETIME(3) NULL,
  UNIQUE INDEX `CommunityMembership_roomId_studentId_key`(`roomId`, `studentId`),
  INDEX `CommunityMembership_studentId_idx`(`studentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CommunityMembership_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `CommunityRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CommunityMembership_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CommunityMessage` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `authorUserId` VARCHAR(191) NOT NULL,
  `body` LONGTEXT NOT NULL,
  `status` ENUM('VISIBLE','HIDDEN','FLAGGED') NOT NULL DEFAULT 'VISIBLE',
  `flagReason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CommunityMessage_roomId_createdAt_idx`(`roomId`, `createdAt`),
  INDEX `CommunityMessage_authorUserId_createdAt_idx`(`authorUserId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CommunityMessage_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `CommunityRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CommunityMessage_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ModerationFlag` (
  `id` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `status` ENUM('OPEN','REVIEWED','ESCALATED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  INDEX `ModerationFlag_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ModerationFlag_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `CommunityMessage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ModerationAction` (
  `id` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `note` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ModerationAction_targetType_targetId_idx`(`targetType`, `targetId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ModerationAction_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TeamProject` (
  `id` VARCHAR(191) NOT NULL,
  `programId` VARCHAR(191) NULL,
  `roomId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` LONGTEXT NULL,
  `dueDate` DATETIME(3) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `TeamProject_programId_status_idx`(`programId`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `TeamProject_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `TeamProject_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `CommunityRoom`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProjectMember` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ProjectMember_projectId_studentId_key`(`projectId`, `studentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ProjectMember_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `TeamProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProjectMember_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProjectTask` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `isComplete` BOOLEAN NOT NULL DEFAULT false,
  `dueDate` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `ProjectTask_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `TeamProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProjectSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `studentId` VARCHAR(191) NOT NULL,
  `submissionText` LONGTEXT NULL,
  `attachmentUrl` VARCHAR(191) NULL,
  `mentorFeedback` LONGTEXT NULL,
  `isShowcaseApproved` BOOLEAN NOT NULL DEFAULT false,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ProjectSubmission_projectId_submittedAt_idx`(`projectId`, `submittedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ProjectSubmission_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `TeamProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ProjectSubmission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
