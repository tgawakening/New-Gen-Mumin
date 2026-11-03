-- Owner-requested correction of the exact student placeholder, not a merge.
-- Parent account names, relationships, IDs, points and submissions are preserved.
START TRANSACTION;

UPDATE `RecognitionAward`
SET `recipientName` = 'Muntaha Fatima'
WHERE LOWER(REPLACE(COALESCE(`recipientName`, ''), ' ', '')) = 'muntahaparent'
  AND EXISTS (SELECT 1 FROM `StudentProfile` s JOIN `User` u ON u.`id` = s.`userId`
    WHERE s.`id` = `RecognitionAward`.`studentId` AND (
      LOWER(REPLACE(COALESCE(s.`displayName`, ''), ' ', '')) IN ('muntahaparent', 'muntahafatima')
      OR (u.`role` = 'STUDENT' AND LOWER(REPLACE(CONCAT(u.`firstName`, COALESCE(u.`lastName`, '')), ' ', '')) = 'muntahaparent'
        AND LOWER(REPLACE(COALESCE(s.`displayName`, ''), ' ', '')) IN ('', 'muntahafatima'))));

UPDATE `RegistrationStudent`
SET `firstName` = 'Muntaha', `lastName` = 'Fatima', `displayName` = 'Muntaha Fatima'
WHERE (LOWER(REPLACE(COALESCE(`displayName`, ''), ' ', '')) = 'muntahaparent'
    OR LOWER(REPLACE(CONCAT(`firstName`, COALESCE(`lastName`, '')), ' ', '')) = 'muntahaparent')
  AND EXISTS (SELECT 1 FROM `StudentProfile` s JOIN `User` u ON u.`id` = s.`userId`
    WHERE s.`id` = `RegistrationStudent`.`studentProfileId` AND (
      LOWER(REPLACE(COALESCE(s.`displayName`, ''), ' ', '')) IN ('muntahaparent', 'muntahafatima')
      OR (u.`role` = 'STUDENT' AND LOWER(REPLACE(CONCAT(u.`firstName`, COALESCE(u.`lastName`, '')), ' ', '')) = 'muntahaparent'
        AND LOWER(REPLACE(COALESCE(s.`displayName`, ''), ' ', '')) IN ('', 'muntahafatima'))));

UPDATE `StudentProfile`
SET `displayName` = 'Muntaha Fatima'
WHERE LOWER(REPLACE(COALESCE(`displayName`, ''), ' ', '')) = 'muntahaparent'
  OR (LOWER(REPLACE(COALESCE(`displayName`, ''), ' ', '')) IN ('', 'muntahafatima')
    AND EXISTS (SELECT 1 FROM `User` u WHERE u.`id` = `StudentProfile`.`userId` AND u.`role` = 'STUDENT'
      AND LOWER(REPLACE(CONCAT(u.`firstName`, COALESCE(u.`lastName`, '')), ' ', '')) = 'muntahaparent'));

UPDATE `User`
SET `firstName` = 'Muntaha', `lastName` = 'Fatima'
WHERE `role` = 'STUDENT'
  AND LOWER(REPLACE(CONCAT(`firstName`, COALESCE(`lastName`, '')), ' ', '')) = 'muntahaparent'
  AND EXISTS (SELECT 1 FROM `StudentProfile` s WHERE s.`userId` = `User`.`id` AND s.`displayName` = 'Muntaha Fatima');

COMMIT;
