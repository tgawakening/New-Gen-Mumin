-- Assign the two explicitly named test learners to their final Qabilas.
-- Exact "... Parent" matching prevents similarly named real learners from being changed.
UPDATE `HouseMembership` hm
JOIN `StudentProfile` sp ON sp.`id` = hm.`studentId`
JOIN `User` u ON u.`id` = sp.`userId`
SET hm.`qabilaGroup` = 'Abubakr ibn Abi Qahafa', hm.`role` = 'MEMBER'
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) = 'ahmad parent'
   OR (LOWER(TRIM(u.`firstName`)) = 'ahmad' AND LOWER(TRIM(u.`lastName`)) = 'parent');

INSERT IGNORE INTO `HouseMembership` (`id`, `houseId`, `studentId`, `joinedAt`, `role`, `qabilaGroup`)
SELECT CONCAT('test_', REPLACE(UUID(), '-', '')), h.`id`, sp.`id`, CURRENT_TIMESTAMP(3), 'MEMBER', 'Abubakr ibn Abi Qahafa'
FROM `StudentProfile` sp
JOIN `User` u ON u.`id` = sp.`userId`
JOIN `House` h ON h.`slug` = 'blue-house'
LEFT JOIN `HouseMembership` hm ON hm.`studentId` = sp.`id`
WHERE hm.`id` IS NULL AND (
  LOWER(TRIM(COALESCE(sp.`displayName`, ''))) = 'ahmad parent'
  OR (LOWER(TRIM(u.`firstName`)) = 'ahmad' AND LOWER(TRIM(u.`lastName`)) = 'parent')
);

UPDATE `HouseMembership` hm
JOIN `StudentProfile` sp ON sp.`id` = hm.`studentId`
JOIN `User` u ON u.`id` = sp.`userId`
SET hm.`qabilaGroup` = 'Khadijah bint Khuwaylid', hm.`role` = 'MEMBER'
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) IN ('khadija parent', 'khadjia parent')
   OR (LOWER(TRIM(u.`firstName`)) IN ('khadija', 'khadjia') AND LOWER(TRIM(u.`lastName`)) = 'parent');

INSERT IGNORE INTO `HouseMembership` (`id`, `houseId`, `studentId`, `joinedAt`, `role`, `qabilaGroup`)
SELECT CONCAT('test_', REPLACE(UUID(), '-', '')), h.`id`, sp.`id`, CURRENT_TIMESTAMP(3), 'MEMBER', 'Khadijah bint Khuwaylid'
FROM `StudentProfile` sp
JOIN `User` u ON u.`id` = sp.`userId`
JOIN `House` h ON h.`slug` = 'white-house'
LEFT JOIN `HouseMembership` hm ON hm.`studentId` = sp.`id`
WHERE hm.`id` IS NULL AND (
  LOWER(TRIM(COALESCE(sp.`displayName`, ''))) IN ('khadija parent', 'khadjia parent')
  OR (LOWER(TRIM(u.`firstName`)) IN ('khadija', 'khadjia') AND LOWER(TRIM(u.`lastName`)) = 'parent')
);

-- Normalize only the Ahmad test learner's name across all learner-backed portal sources.
UPDATE `RegistrationStudent` rs
JOIN `StudentProfile` sp ON sp.`id` = rs.`studentProfileId`
JOIN `User` u ON u.`id` = sp.`userId`
SET rs.`firstName` = 'Ahmad', rs.`lastName` = NULL, rs.`displayName` = 'Ahmad'
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) = 'ahmad parent'
   OR (LOWER(TRIM(u.`firstName`)) = 'ahmad' AND LOWER(TRIM(u.`lastName`)) = 'parent');

UPDATE `StudentProfile` sp
JOIN `User` u ON u.`id` = sp.`userId`
SET sp.`displayName` = 'Ahmad'
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) = 'ahmad parent'
   OR (LOWER(TRIM(u.`firstName`)) = 'ahmad' AND LOWER(TRIM(u.`lastName`)) = 'parent');

UPDATE `User` u
JOIN `StudentProfile` sp ON sp.`userId` = u.`id`
SET u.`firstName` = 'Ahmad', u.`lastName` = ''
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) IN ('ahmad parent', 'ahmad')
  AND LOWER(TRIM(u.`firstName`)) = 'ahmad'
  AND LOWER(TRIM(u.`lastName`)) = 'parent';