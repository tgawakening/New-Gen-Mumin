CREATE TABLE TeacherPayrollSettings (
 teacherId VARCHAR(191) NOT NULL, driveFolderId VARCHAR(191) NULL, showPkr BOOLEAN NOT NULL DEFAULT false, updatedAt DATETIME(3) NOT NULL,
 PRIMARY KEY (teacherId), CONSTRAINT TeacherPayrollSettings_teacherId_fkey FOREIGN KEY (teacherId) REFERENCES TeacherProfile(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE TeacherPayslip (
 id VARCHAR(191) NOT NULL, teacherId VARCHAR(191) NOT NULL, month VARCHAR(7) NOT NULL, draftData JSON NOT NULL, publishedData JSON NULL,
 version INTEGER NOT NULL DEFAULT 1, publishedAt DATETIME(3) NULL, updatedByUserId VARCHAR(191) NOT NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updatedAt DATETIME(3) NOT NULL,
 PRIMARY KEY(id), UNIQUE INDEX TeacherPayslip_teacherId_month_key(teacherId,month), INDEX TeacherPayslip_teacherId_publishedAt_idx(teacherId,publishedAt),
 CONSTRAINT TeacherPayslip_teacherId_fkey FOREIGN KEY(teacherId) REFERENCES TeacherProfile(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE TeacherPayslipRevision (
 id VARCHAR(191) NOT NULL, payslipId VARCHAR(191) NOT NULL, version INTEGER NOT NULL, snapshot JSON NOT NULL,
 publishedByUserId VARCHAR(191) NOT NULL, publishedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
 UNIQUE INDEX TeacherPayslipRevision_payslipId_version_key(payslipId,version), CONSTRAINT TeacherPayslipRevision_payslipId_fkey FOREIGN KEY(payslipId) REFERENCES TeacherPayslip(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
