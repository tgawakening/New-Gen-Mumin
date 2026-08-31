UPDATE MissionAttempt AS attempt
INNER JOIN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY studentId, submissionDay
      ORDER BY createdAt ASC, id ASC
    ) AS daily_rank
    FROM MissionAttempt
    WHERE submissionDay IS NOT NULL
  ) AS ranked_attempts
  WHERE daily_rank > 1
) AS duplicate_attempt ON duplicate_attempt.id = attempt.id
SET attempt.submissionDay = NULL;

DROP INDEX MissionAttempt_daily_submission_key ON MissionAttempt;

CREATE UNIQUE INDEX MissionAttempt_student_daily_submission_key
  ON MissionAttempt(studentId, submissionDay);

DELETE duplicate_entry
FROM HousePointLedger AS duplicate_entry
INNER JOIN HousePointLedger AS original_entry
  ON duplicate_entry.studentId = original_entry.studentId
  AND duplicate_entry.sourceType = 'SUNNAH_DAILY'
  AND original_entry.sourceType = 'SUNNAH_DAILY'
  AND RIGHT(duplicate_entry.sourceId, 10) = RIGHT(original_entry.sourceId, 10)
  AND (
    duplicate_entry.awardedAt > original_entry.awardedAt
    OR (duplicate_entry.awardedAt = original_entry.awardedAt AND duplicate_entry.id > original_entry.id)
  );