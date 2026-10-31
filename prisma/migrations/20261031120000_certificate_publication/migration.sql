-- Preserve the original child's Qabila when a Mum certificate is hidden and republished.
ALTER TABLE `ParentRecognitionAward` ADD COLUMN `pointsStudentId` VARCHAR(191) NULL;

-- The requested initial state is private for existing weekly certificates.
-- Keep the original child before withdrawing the Mum award's published credit.
UPDATE `ParentRecognitionAward` AS a
JOIN `HousePointLedger` AS p ON p.`sourceId` = a.`id` AND p.`sourceType` = 'PARENT_RECOGNITION_MUM_OF_WEEK'
SET a.`pointsStudentId` = p.`studentId`
WHERE a.`pointsStudentId` IS NULL;

UPDATE `RecognitionAward` SET `isPublic` = false WHERE `badgeKey` = 'MUMIN_OF_WEEK';
UPDATE `ParentRecognitionAward` SET `isPublic` = false;

DELETE n FROM `Notification` AS n
JOIN `RecognitionAward` AS a ON a.`badgeKey` = 'MUMIN_OF_WEEK'
AND (n.`href` = CONCAT('/certificates/', a.`certificateCode`)
  OR n.`href` = CONCAT('/badges/', a.`certificateCode`)
  OR n.`href` LIKE CONCAT('/teacher/recognition?award=', a.`id`, '&%'));

DELETE n FROM `Notification` AS n
JOIN `ParentRecognitionAward` AS a
ON n.`href` = CONCAT('/parent-certificates/', a.`certificateCode`)
OR (n.`href` = '/parent/rewards' AND LENGTH(a.`evidence`) > 0 AND LOCATE(a.`evidence`, n.`body`) > 0);

DELETE p FROM `HousePointLedger` AS p
JOIN `RecognitionAward` AS a ON p.`sourceId` = a.`id`
WHERE a.`badgeKey` = 'MUMIN_OF_WEEK' AND p.`sourceType` = 'RECOGNITION_MUMIN_OF_WEEK';

DELETE p FROM `HousePointLedger` AS p
JOIN `ParentRecognitionAward` AS a ON p.`sourceId` = a.`id`
WHERE p.`sourceType` = 'PARENT_RECOGNITION_MUM_OF_WEEK';
