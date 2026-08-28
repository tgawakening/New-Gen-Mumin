DELETE duplicate_entry
FROM HousePointLedger AS duplicate_entry
INNER JOIN HousePointLedger AS original_entry
  ON duplicate_entry.studentId = original_entry.studentId
  AND duplicate_entry.sourceType = original_entry.sourceType
  AND duplicate_entry.sourceId = original_entry.sourceId
  AND duplicate_entry.id > original_entry.id
WHERE duplicate_entry.sourceId IS NOT NULL;

CREATE UNIQUE INDEX HousePointLedger_student_source_key
  ON HousePointLedger(studentId, sourceType, sourceId);

ALTER TABLE MissionAttempt ADD COLUMN submissionDay VARCHAR(10) NULL;
CREATE UNIQUE INDEX MissionAttempt_daily_submission_key ON MissionAttempt(missionId, studentId, submissionDay);
