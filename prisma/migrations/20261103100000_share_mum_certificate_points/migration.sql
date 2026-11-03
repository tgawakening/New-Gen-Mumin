-- One 150-point Mum award is shared across all linked children with Qabilas.
-- Rebalance existing published awards without emails, publication changes or extra bonuses.
START TRANSACTION;

DELETE FROM `HousePointLedger`
WHERE `sourceType` = 'PARENT_RECOGNITION_MUM_OF_WEEK'
  AND `sourceId` IN (SELECT a.`id` FROM `ParentRecognitionAward` a
    WHERE a.`badgeKey` = 'MUM_OF_WEEK' AND a.`isPublic` = true AND a.`revokedAt` IS NULL
      AND EXISTS (SELECT 1 FROM `ParentStudent` ps JOIN `HouseMembership` m ON m.`studentId` = ps.`studentId`
        WHERE ps.`parentId` = a.`parentId` AND m.`qabilaGroup` IS NOT NULL AND TRIM(m.`qabilaGroup`) <> ''));

INSERT INTO `HousePointLedger` (`id`, `houseId`, `studentId`, `points`, `reason`, `sourceType`, `sourceId`, `awardedAt`)
SELECT CONCAT('mum-share-', a.`id`, '-', ps.`studentId`), m.`houseId`, ps.`studentId`,
  150 DIV family.`childCount` + CASE WHEN
    (SELECT COUNT(*) FROM `ParentStudent` sibling JOIN `HouseMembership` sm ON sm.`studentId` = sibling.`studentId`
      WHERE sibling.`parentId` = a.`parentId` AND sibling.`studentId` < ps.`studentId`
        AND sm.`qabilaGroup` IS NOT NULL AND TRIM(sm.`qabilaGroup`) <> '') < MOD(150, family.`childCount`)
    THEN 1 ELSE 0 END,
  'Mum of the Week: shared family certificate bonus', 'PARENT_RECOGNITION_MUM_OF_WEEK', a.`id`, a.`awardedAt`
FROM `ParentRecognitionAward` a
JOIN `ParentStudent` ps ON ps.`parentId` = a.`parentId`
JOIN `HouseMembership` m ON m.`studentId` = ps.`studentId`
JOIN (SELECT linked.`parentId`, COUNT(*) AS `childCount` FROM `ParentStudent` linked
  JOIN `HouseMembership` membership ON membership.`studentId` = linked.`studentId`
  WHERE membership.`qabilaGroup` IS NOT NULL AND TRIM(membership.`qabilaGroup`) <> ''
  GROUP BY linked.`parentId`) family ON family.`parentId` = a.`parentId`
WHERE a.`badgeKey` = 'MUM_OF_WEEK' AND a.`isPublic` = true AND a.`revokedAt` IS NULL
  AND m.`qabilaGroup` IS NOT NULL AND TRIM(m.`qabilaGroup`) <> '';

UPDATE `ParentRecognitionAward` SET `pointsStudentId` = NULL
WHERE `badgeKey` = 'MUM_OF_WEEK' AND `isPublic` = true AND `revokedAt` IS NULL
  AND EXISTS (SELECT 1 FROM `ParentStudent` ps JOIN `HouseMembership` m ON m.`studentId` = ps.`studentId`
    WHERE ps.`parentId` = `ParentRecognitionAward`.`parentId` AND m.`qabilaGroup` IS NOT NULL AND TRIM(m.`qabilaGroup`) <> '');

COMMIT;
