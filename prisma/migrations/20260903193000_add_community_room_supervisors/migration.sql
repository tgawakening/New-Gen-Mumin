CREATE TABLE `CommunityRoomSupervisor` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'MENTOR',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CommunityRoomSupervisor_roomId_userId_key`(`roomId`, `userId`),
  INDEX `CommunityRoomSupervisor_userId_idx`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CommunityRoomSupervisor_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `CommunityRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CommunityRoomSupervisor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
