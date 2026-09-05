ALTER TABLE `CommunityMessage`
  ADD COLUMN `audioDriveFileId` VARCHAR(191) NULL,
  ADD COLUMN `audioMimeType` VARCHAR(191) NULL,
  ADD COLUMN `audioDurationSeconds` INTEGER NULL;
