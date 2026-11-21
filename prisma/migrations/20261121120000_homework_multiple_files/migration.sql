-- Additive change: existing single-file submissions remain in attachmentUrl.
ALTER TABLE `AssignmentSubmission` ADD COLUMN `attachmentFiles` JSON NULL;
