ALTER TABLE HouseMembership ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'MEMBER', ADD COLUMN qabilaGroup VARCHAR(64) NULL;

CREATE TABLE RecognitionAward (
  id VARCHAR(191) NOT NULL,
  studentId VARCHAR(191) NOT NULL,
  badgeKey VARCHAR(191) NOT NULL,
  title VARCHAR(191) NOT NULL,
  category VARCHAR(191) NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT NULL,
  awardedByUserId VARCHAR(191) NULL,
  beneficiaryStudentId VARCHAR(191) NULL,
  sourceType VARCHAR(191) NOT NULL,
  sourceId VARCHAR(191) NOT NULL,
  pointsBonus INTEGER NOT NULL DEFAULT 0,
  featuredWeek VARCHAR(10) NULL,
  isPublic BOOLEAN NOT NULL DEFAULT true,
  certificateCode VARCHAR(191) NOT NULL,
  awardedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX RecognitionAward_certificateCode_key (certificateCode),
  UNIQUE INDEX RecognitionAward_student_badge_source_key (studentId, badgeKey, sourceType, sourceId),
  INDEX RecognitionAward_studentId_awardedAt_idx (studentId, awardedAt),
  INDEX RecognitionAward_featuredWeek_isPublic_idx (featuredWeek, isPublic),
  CONSTRAINT RecognitionAward_studentId_fkey FOREIGN KEY (studentId) REFERENCES StudentProfile(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE HouseUnlock (
  id VARCHAR(191) NOT NULL,
  houseId VARCHAR(191) NOT NULL,
  milestone INTEGER NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  unlockedAt DATETIME(3) NULL,
  claimedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX HouseUnlock_houseId_milestone_key (houseId, milestone),
  INDEX HouseUnlock_houseId_unlockedAt_idx (houseId, unlockedAt),
  CONSTRAINT HouseUnlock_houseId_fkey FOREIGN KEY (houseId) REFERENCES House(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;