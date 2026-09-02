ALTER TABLE AttendanceRecord ADD COLUMN attendanceDay VARCHAR(10) NULL;

UPDATE AttendanceRecord
SET attendanceDay = DATE_FORMAT(DATE_ADD(lessonDate, INTERVAL 5 HOUR), '%Y-%m-%d')
WHERE scheduleId IS NOT NULL;

DELETE duplicate_record
FROM AttendanceRecord AS duplicate_record
INNER JOIN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY scheduleId, studentId, attendanceDay
      ORDER BY
        CASE status WHEN 'PRESENT' THEN 3 WHEN 'LATE' THEN 2 WHEN 'EXCUSED' THEN 1 ELSE 0 END DESC,
        COALESCE(durationMinutes, 0) DESC,
        updatedAt DESC,
        id ASC
    ) AS duplicate_rank
    FROM AttendanceRecord
    WHERE scheduleId IS NOT NULL AND attendanceDay IS NOT NULL
  ) AS ranked_records
  WHERE duplicate_rank > 1
) AS duplicate_ids ON duplicate_ids.id = duplicate_record.id;

CREATE UNIQUE INDEX AttendanceRecord_session_student_day_key
  ON AttendanceRecord(scheduleId, studentId, attendanceDay);