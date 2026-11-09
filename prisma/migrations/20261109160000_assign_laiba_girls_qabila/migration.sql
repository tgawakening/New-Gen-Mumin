-- Owner-authorized assignment: Laiba, daughter of Anum Sheikh/Shaikh.
-- Never match Laiba by name alone, and do nothing if more than one family matches.
-- Existing correct girls' assignments are preserved. No points or messages are created.
START TRANSACTION;

CREATE TEMPORARY TABLE `_LaibaCandidates` AS
SELECT s.`id` AS `studentId`, s.`createdAt`, MAX(r.`createdAt`) AS `approvedAt`,
  LOWER(TRIM(COALESCE(r.`parentEmail`, pu.`email`))) AS `familyEmail`
FROM `StudentProfile` s
JOIN `User` u ON u.`id` = s.`userId` AND u.`role` = 'STUDENT' AND u.`status` = 'ACTIVE'
LEFT JOIN `RegistrationStudent` rs ON rs.`studentProfileId` = s.`id`
LEFT JOIN `Registration` r ON r.`id` = rs.`registrationId` AND r.`status` IN ('PAID', 'CONVERTED')
LEFT JOIN `ParentStudent` ps ON ps.`studentId` = s.`id`
LEFT JOIN `ParentProfile` p ON p.`id` = ps.`parentId`
LEFT JOIN `User` pu ON pu.`id` = p.`userId`
WHERE EXISTS (SELECT 1 FROM `Enrollment` e WHERE e.`studentId` = s.`id` AND e.`status` IN ('CONFIRMED', 'ACTIVE', 'COMPLETED'))
  AND (r.`id` IS NOT NULL OR NOT EXISTS (SELECT 1 FROM `RegistrationStudent` anyrs WHERE anyrs.`studentProfileId` = s.`id`))
  AND (LOWER(TRIM(rs.`firstName`)) = 'laiba' OR LOWER(TRIM(rs.`firstName`)) LIKE 'laiba %'
    OR LOWER(TRIM(u.`firstName`)) = 'laiba' OR LOWER(TRIM(u.`firstName`)) LIKE 'laiba %'
    OR LOWER(TRIM(s.`displayName`)) = 'laiba' OR LOWER(TRIM(s.`displayName`)) LIKE 'laiba %')
  AND (LOWER(REPLACE(CONCAT(COALESCE(pu.`firstName`, ''), COALESCE(pu.`lastName`, '')), ' ', '')) IN ('anumsheikh', 'anumshaikh')
    OR LOWER(REPLACE(CONCAT(COALESCE(r.`parentFirstName`, ''), COALESCE(r.`parentLastName`, '')), ' ', '')) IN ('anumsheikh', 'anumshaikh'))
GROUP BY s.`id`, s.`createdAt`, LOWER(TRIM(COALESCE(r.`parentEmail`, pu.`email`)));

CREATE TEMPORARY TABLE `_LaibaFamilies` AS
SELECT COUNT(DISTINCT `familyEmail`) AS `families` FROM `_LaibaCandidates`;
CREATE TEMPORARY TABLE `_LaibaTarget` AS
SELECT c.`studentId` FROM `_LaibaCandidates` c CROSS JOIN `_LaibaFamilies` f
WHERE f.`families` = 1
ORDER BY c.`approvedAt` DESC, c.`createdAt` DESC, c.`studentId` ASC LIMIT 1;

-- Recover the exact parent link from her approved registration if it is missing.
INSERT INTO `ParentStudent` (`id`, `parentId`, `studentId`, `relation`, `createdAt`)
SELECT DISTINCT CONCAT('laiba-parent-', t.`studentId`, '-', p.`id`), p.`id`, t.`studentId`, 'CHILD', NOW()
FROM `_LaibaTarget` t JOIN `RegistrationStudent` rs ON rs.`studentProfileId` = t.`studentId`
JOIN `Registration` r ON r.`id` = rs.`registrationId` AND r.`status` IN ('PAID', 'CONVERTED')
JOIN `ParentProfile` p ON p.`id` = r.`parentProfileId` JOIN `User` u ON u.`id` = p.`userId`
WHERE LOWER(REPLACE(CONCAT(u.`firstName`, COALESCE(u.`lastName`, '')), ' ', '')) IN ('anumsheikh', 'anumshaikh')
  AND NOT EXISTS (SELECT 1 FROM `ParentStudent` ps WHERE ps.`parentId` = p.`id` AND ps.`studentId` = t.`studentId`);

-- Count canonical enrolled girls, so repeated paid registrations do not skew the balance.
CREATE TEMPORARY TABLE `_LaibaGirlMembers` AS
SELECT m.`studentId`, m.`qabilaGroup`, s.`createdAt` AS `profileCreated`, r.`createdAt` AS `approvedAt`,
  CONCAT(LOWER(TRIM(COALESCE(r.`parentEmail`,
    (SELECT pu.`email` FROM `ParentStudent` ps JOIN `ParentProfile` p ON p.`id` = ps.`parentId` JOIN `User` pu ON pu.`id` = p.`userId`
      WHERE ps.`studentId` = s.`id` ORDER BY p.`id` LIMIT 1), u.`email`))), '|',
    LOWER(REPLACE(CASE WHEN rs.`id` IS NOT NULL THEN CONCAT(rs.`firstName`, COALESCE(rs.`lastName`, ''))
      ELSE COALESCE(NULLIF(s.`displayName`, ''), CONCAT(u.`firstName`, COALESCE(u.`lastName`, ''))) END, ' ', ''))) AS `identityKey`
FROM `HouseMembership` m JOIN `StudentProfile` s ON s.`id` = m.`studentId`
JOIN `User` u ON u.`id` = s.`userId` AND u.`role` = 'STUDENT' AND u.`status` = 'ACTIVE'
LEFT JOIN `RegistrationStudent` rs ON rs.`id` = (
  SELECT latest.`id` FROM `RegistrationStudent` latest JOIN `Registration` approved ON approved.`id` = latest.`registrationId`
  WHERE latest.`studentProfileId` = s.`id` AND approved.`status` IN ('PAID', 'CONVERTED')
  ORDER BY approved.`createdAt` DESC, latest.`id` LIMIT 1)
LEFT JOIN `Registration` r ON r.`id` = rs.`registrationId`
WHERE m.`studentId` NOT IN (SELECT `studentId` FROM `_LaibaTarget`)
  AND m.`qabilaGroup` IN ('Qabila Banu Makhzum', 'Girls Qabila A', 'Maryam bint Imran', 'Qabila Banu Zuhra', 'Girls Qabila B', 'Khadijah bint Khuwaylid')
  AND EXISTS (SELECT 1 FROM `Enrollment` e WHERE e.`studentId` = s.`id` AND e.`status` IN ('CONFIRMED', 'ACTIVE', 'COMPLETED'))
  AND (r.`id` IS NOT NULL OR NOT EXISTS (SELECT 1 FROM `RegistrationStudent` anyrs WHERE anyrs.`studentProfileId` = s.`id`));
CREATE TEMPORARY TABLE `_LaibaGirlsCounts` AS
SELECT
  COALESCE(SUM(CASE WHEN ranked.`qabilaGroup` IN ('Qabila Banu Makhzum', 'Girls Qabila A', 'Maryam bint Imran') THEN 1 ELSE 0 END), 0) AS `makhzum`,
  COALESCE(SUM(CASE WHEN ranked.`qabilaGroup` IN ('Qabila Banu Zuhra', 'Girls Qabila B', 'Khadijah bint Khuwaylid') THEN 1 ELSE 0 END), 0) AS `zuhra`
FROM (SELECT members.*, ROW_NUMBER() OVER (PARTITION BY members.`identityKey` ORDER BY members.`approvedAt` DESC, members.`profileCreated` DESC, members.`studentId`) AS `rankNumber`
  FROM `_LaibaGirlMembers` members) ranked WHERE ranked.`rankNumber` = 1;

-- A house is needed for the ledger even when a learner has not earned points yet.
INSERT INTO `House` (`id`, `slug`, `name`, `virtue`, `color`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT 'laiba-default-blue-house', 'blue-house', 'Blue House', 'Wisdom', '#2563eb', 4, NOW(), NOW()
FROM `_LaibaTarget` WHERE NOT EXISTS (SELECT 1 FROM `House`);

CREATE TEMPORARY TABLE `_LaibaChoice` AS
SELECT t.`studentId`, COALESCE(m.`houseId`, (SELECT h.`id` FROM `House` h ORDER BY h.`sortOrder`, h.`id` LIMIT 1)) AS `houseId`,
  CASE WHEN m.`qabilaGroup` IN ('Qabila Banu Makhzum', 'Girls Qabila A', 'Maryam bint Imran') THEN 'Qabila Banu Makhzum'
    WHEN m.`qabilaGroup` IN ('Qabila Banu Zuhra', 'Girls Qabila B', 'Khadijah bint Khuwaylid') THEN 'Qabila Banu Zuhra'
    WHEN c.`makhzum` <= c.`zuhra` THEN 'Qabila Banu Makhzum' ELSE 'Qabila Banu Zuhra' END AS `qabilaGroup`,
  CASE WHEN m.`qabilaGroup` IN ('Qabila Banu Makhzum', 'Girls Qabila A', 'Maryam bint Imran', 'Qabila Banu Zuhra', 'Girls Qabila B', 'Khadijah bint Khuwaylid') THEN m.`role` ELSE 'MEMBER' END AS `role`
FROM `_LaibaTarget` t CROSS JOIN `_LaibaGirlsCounts` c LEFT JOIN `HouseMembership` m ON m.`studentId` = t.`studentId`;

UPDATE `HouseMembership` SET `qabilaGroup` = (SELECT c.`qabilaGroup` FROM `_LaibaChoice` c)
WHERE `studentId` IN (SELECT `studentId` FROM `_LaibaTarget`);
UPDATE `HouseMembership` SET `role` = (SELECT c.`role` FROM `_LaibaChoice` c)
WHERE `studentId` IN (SELECT `studentId` FROM `_LaibaTarget`);
INSERT INTO `HouseMembership` (`id`, `studentId`, `houseId`, `qabilaGroup`, `role`, `joinedAt`)
SELECT CONCAT('laiba-qabila-', c.`studentId`), c.`studentId`, c.`houseId`, c.`qabilaGroup`, c.`role`, NOW()
FROM `_LaibaChoice` c WHERE NOT EXISTS (SELECT 1 FROM `HouseMembership` m WHERE m.`studentId` = c.`studentId`);

INSERT INTO `CommunityRoom` (`id`, `title`, `description`, `type`, `visibility`, `ageBand`, `genderScope`, `isReadOnly`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('laiba-girls-room-', CASE WHEN c.`qabilaGroup` = 'Qabila Banu Makhzum' THEN 'a' ELSE 'b' END),
  c.`qabilaGroup`, 'A supervised Qabila team room for mentor-guided planning, encouragement, and safe community projects.',
  'PROJECT_TEAM', 'STUDENTS', 'GENERAL', 'GIRLS', false, true, NOW(), NOW()
FROM `_LaibaChoice` c WHERE NOT EXISTS (SELECT 1 FROM `CommunityRoom` r WHERE r.`title` = c.`qabilaGroup` AND r.`type` = 'PROJECT_TEAM' AND r.`isActive` = true);
CREATE TEMPORARY TABLE `_LaibaRoom` AS
SELECT r.`id` AS `roomId`, c.`studentId`, c.`role` FROM `CommunityRoom` r JOIN `_LaibaChoice` c ON c.`qabilaGroup` = r.`title`
WHERE r.`type` = 'PROJECT_TEAM' AND r.`isActive` = true ORDER BY r.`createdAt`, r.`id` LIMIT 1;
UPDATE `CommunityRoom` SET `genderScope` = 'GIRLS', `isReadOnly` = false, `visibility` = 'STUDENTS', `updatedAt` = NOW()
WHERE `id` IN (SELECT `roomId` FROM `_LaibaRoom`);
DELETE FROM `CommunityMembership` WHERE `studentId` IN (SELECT `studentId` FROM `_LaibaTarget`)
  AND `roomId` IN (SELECT r.`id` FROM `CommunityRoom` r WHERE r.`type` = 'PROJECT_TEAM' AND r.`title` IN ('Qabila Banu Makhzum', 'Qabila Banu Zuhra', 'Qabila Banu Hashim', 'Qabila Banu Asad', 'Girls Qabila A', 'Girls Qabila B', 'Boys Qabila A', 'Boys Qabila B', 'Maryam bint Imran', 'Khadijah bint Khuwaylid', 'Abubakr ibn Abi Qahafa', 'Umar Ibn Al Khattab'))
  AND `roomId` NOT IN (SELECT `roomId` FROM `_LaibaRoom`);
INSERT INTO `CommunityMembership` (`id`, `roomId`, `studentId`, `role`, `joinedAt`)
SELECT CONCAT('laiba-room-', r.`studentId`), r.`roomId`, r.`studentId`, r.`role`, NOW() FROM `_LaibaRoom` r
WHERE NOT EXISTS (SELECT 1 FROM `CommunityMembership` m WHERE m.`roomId` = r.`roomId` AND m.`studentId` = r.`studentId`);

DROP TEMPORARY TABLE `_LaibaRoom`;
DROP TEMPORARY TABLE `_LaibaChoice`;
DROP TEMPORARY TABLE `_LaibaGirlsCounts`;
DROP TEMPORARY TABLE `_LaibaGirlMembers`;
DROP TEMPORARY TABLE `_LaibaTarget`;
DROP TEMPORARY TABLE `_LaibaFamilies`;
DROP TEMPORARY TABLE `_LaibaCandidates`;
COMMIT;
