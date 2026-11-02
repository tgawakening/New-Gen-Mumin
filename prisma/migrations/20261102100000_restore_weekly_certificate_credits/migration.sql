-- Repair published certificates only. Private/revoked certificates stay uncredited.
-- Keep one 150-point credit per certificate, including on repeated deployments.
START TRANSACTION;

UPDATE `ParentRecognitionAward`
SET `pointsStudentId` = COALESCE(
  (SELECT MIN(p.`studentId`) FROM `HousePointLedger` p
   WHERE p.`sourceType` = 'PARENT_RECOGNITION_MUM_OF_WEEK' AND p.`sourceId` = `ParentRecognitionAward`.`id`),
  (SELECT MIN(ps.`studentId`) FROM `ParentStudent` ps
   JOIN `HouseMembership` m ON m.`studentId` = ps.`studentId`
   WHERE ps.`parentId` = `ParentRecognitionAward`.`parentId` AND m.`qabilaGroup` IS NOT NULL AND m.`qabilaGroup` <> '')
)
WHERE `pointsStudentId` IS NULL AND `badgeKey` = 'MUM_OF_WEEK' AND `isPublic` = true AND `revokedAt` IS NULL;

INSERT INTO `HousePointLedger` (`id`, `houseId`, `studentId`, `points`, `reason`, `sourceType`, `sourceId`, `awardedAt`)
SELECT CONCAT('weekly-mumin-', a.`id`), m.`houseId`, a.`studentId`, 150,
  'Mumin of the Week: weekly certificate bonus', 'RECOGNITION_MUMIN_OF_WEEK', a.`id`, a.`awardedAt`
FROM `RecognitionAward` a JOIN `HouseMembership` m ON m.`studentId` = a.`studentId`
WHERE a.`badgeKey` = 'MUMIN_OF_WEEK' AND a.`isPublic` = true AND a.`revokedAt` IS NULL
  AND m.`qabilaGroup` IS NOT NULL AND m.`qabilaGroup` <> ''
  AND NOT EXISTS (SELECT 1 FROM `HousePointLedger` p WHERE p.`sourceType` = 'RECOGNITION_MUMIN_OF_WEEK' AND p.`sourceId` = a.`id`)
ON DUPLICATE KEY UPDATE `id` = `HousePointLedger`.`id`;

INSERT INTO `HousePointLedger` (`id`, `houseId`, `studentId`, `points`, `reason`, `sourceType`, `sourceId`, `awardedAt`)
SELECT CONCAT('weekly-mum-', a.`id`), m.`houseId`, a.`pointsStudentId`, 150,
  'Mum of the Week: weekly certificate bonus', 'PARENT_RECOGNITION_MUM_OF_WEEK', a.`id`, a.`awardedAt`
FROM `ParentRecognitionAward` a JOIN `HouseMembership` m ON m.`studentId` = a.`pointsStudentId`
WHERE a.`badgeKey` = 'MUM_OF_WEEK' AND a.`isPublic` = true AND a.`revokedAt` IS NULL
  AND m.`qabilaGroup` IS NOT NULL AND m.`qabilaGroup` <> ''
  AND NOT EXISTS (SELECT 1 FROM `HousePointLedger` p WHERE p.`sourceType` = 'PARENT_RECOGNITION_MUM_OF_WEEK' AND p.`sourceId` = a.`id`)
ON DUPLICATE KEY UPDATE `id` = `HousePointLedger`.`id`;

COMMIT;
