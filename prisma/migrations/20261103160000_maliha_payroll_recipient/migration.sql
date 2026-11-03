-- Finance-only payroll recipient for the existing Communications account.
-- isActive=false does not create an active teaching profile or change her user role.
INSERT INTO `TeacherProfile` (`id`, `userId`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('payroll-', u.`id`), u.`id`, false, NOW(), NOW()
FROM `User` u
WHERE u.`email` = 'emancheman413@gmail.com' AND u.`role` = 'COMMUNICATIONS' AND u.`status` = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM `TeacherProfile` p WHERE p.`userId` = u.`id`);
