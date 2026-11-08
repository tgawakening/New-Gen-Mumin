ALTER TABLE `RecognitionAward`
  ADD COLUMN `secondStudentId` VARCHAR(191) NULL,
  ADD COLUMN `certificateKind` VARCHAR(191) NULL,
  ADD INDEX `RecognitionAward_secondStudentId_idx` (`secondStudentId`),
  ADD CONSTRAINT `RecognitionAward_secondStudentId_fkey` FOREIGN KEY (`secondStudentId`) REFERENCES `StudentProfile` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
