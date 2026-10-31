-- Repair only saved quiz scores. Never infer marks from attendance or quiz seats.
-- Manually changed live credits (different from the response's recorded old credit)
-- are preserved for administrator review. All other activity and bonus credits stay intact.
START TRANSACTION;

UPDATE `HousePointLedger` AS l
SET `points` = (SELECT r.`earnedPoints` FROM `QuizLiveResponse` r WHERE r.`id` = l.`sourceId` AND r.`studentId` = l.`studentId`),
  `reason` = CONCAT('Live quiz answer: ', (SELECT r.`earnedPoints` FROM `QuizLiveResponse` r WHERE r.`id` = l.`sourceId` AND r.`studentId` = l.`studentId`), ' earned Qabila points')
WHERE l.`sourceType` = 'QUIZ_LIVE_ANSWER' AND EXISTS (
  SELECT 1 FROM `QuizLiveResponse` r WHERE r.`id` = l.`sourceId` AND r.`studentId` = l.`studentId`
    AND r.`earnedPoints` >= 0 AND l.`points` = r.`housePointsAwarded` AND l.`points` <> r.`earnedPoints`
);

INSERT INTO `HousePointLedger` (`id`, `houseId`, `studentId`, `points`, `reason`, `sourceType`, `sourceId`, `awardedAt`)
SELECT CONCAT('quiz-credit-repair:', r.`id`), m.`houseId`, r.`studentId`, r.`earnedPoints`,
  CONCAT('Live quiz answer: ', r.`earnedPoints`, ' earned Qabila points'), 'QUIZ_LIVE_ANSWER', r.`id`, r.`answeredAt`
FROM `QuizLiveResponse` AS r
JOIN `HouseMembership` AS m ON m.`studentId` = r.`studentId`
LEFT JOIN `HousePointLedger` AS l ON l.`studentId` = r.`studentId` AND l.`sourceType` = 'QUIZ_LIVE_ANSWER' AND l.`sourceId` = r.`id`
WHERE l.`id` IS NULL AND r.`earnedPoints` > 0
ON DUPLICATE KEY UPDATE `id` = `HousePointLedger`.`id`;

UPDATE `QuizLiveResponse` AS r
SET `housePointsAwarded` = COALESCE((SELECT l.`points` FROM `HousePointLedger` l WHERE l.`studentId` = r.`studentId` AND l.`sourceType` = 'QUIZ_LIVE_ANSWER' AND l.`sourceId` = r.`id`), 0)
WHERE r.`earnedPoints` >= 0 AND r.`housePointsAwarded` <> r.`earnedPoints`
  AND COALESCE((SELECT l.`points` FROM `HousePointLedger` l WHERE l.`studentId` = r.`studentId` AND l.`sourceType` = 'QUIZ_LIVE_ANSWER' AND l.`sourceId` = r.`id`), 0) = r.`earnedPoints`;

-- Recover missing ordinary-quiz credits from finalized saved scores only.
-- Existing credits (including any existing perfect-score bonus) are never replaced.
INSERT INTO `HousePointLedger` (`id`, `houseId`, `studentId`, `points`, `reason`, `sourceType`, `sourceId`, `awardedAt`)
SELECT CONCAT('quiz-attempt-repair:', a.`id`), m.`houseId`, a.`studentId`, a.`autoScore`,
  LEFT(CONCAT(q.`title`, ': saved quiz score'), 191), 'QUIZ', a.`id`, a.`submittedAt`
FROM `QuizAttempt` AS a
JOIN `Quiz` AS q ON q.`id` = a.`quizId`
JOIN `HouseMembership` AS m ON m.`studentId` = a.`studentId`
LEFT JOIN `HousePointLedger` AS l ON l.`studentId` = a.`studentId` AND l.`sourceType` = 'QUIZ' AND l.`sourceId` = a.`id`
WHERE a.`submittedAt` IS NOT NULL AND a.`autoScore` > 0 AND (a.`manualScore` IS NULL OR a.`manualScore` = a.`autoScore`) AND l.`id` IS NULL
ON DUPLICATE KEY UPDATE `id` = `HousePointLedger`.`id`;

COMMIT;
