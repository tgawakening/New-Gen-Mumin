-- CreateTable
CREATE TABLE `TeacherStudentRoster` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeacherStudentRoster_programId_fkey`(`programId`),
    INDEX `TeacherStudentRoster_studentId_fkey`(`studentId`),
    UNIQUE INDEX `TeacherStudentRoster_teacherId_programId_studentId_key`(`teacherId`, `programId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassScheduleRoster` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `studentId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClassScheduleRoster_scheduleId_fkey`(`scheduleId`),
    INDEX `ClassScheduleRoster_studentId_fkey`(`studentId`),
    UNIQUE INDEX `ClassScheduleRoster_scheduleId_studentId_key`(`scheduleId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeacherStudentRoster` ADD CONSTRAINT `TeacherStudentRoster_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherStudentRoster` ADD CONSTRAINT `TeacherStudentRoster_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherStudentRoster` ADD CONSTRAINT `TeacherStudentRoster_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassScheduleRoster` ADD CONSTRAINT `ClassScheduleRoster_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `ClassSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassScheduleRoster` ADD CONSTRAINT `ClassScheduleRoster_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
