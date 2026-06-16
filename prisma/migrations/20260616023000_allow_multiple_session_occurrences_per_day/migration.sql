DROP INDEX `LiveClassSessionOccurrence_scheduleId_teacherUserId_occurrenceDate_source_key`
  ON `LiveClassSessionOccurrence`;

CREATE INDEX `LiveClassSessionOccurrence_scheduleId_teacherUserId_occurrenceDate_source_idx`
  ON `LiveClassSessionOccurrence`(`scheduleId`, `teacherUserId`, `occurrenceDate`, `source`);
