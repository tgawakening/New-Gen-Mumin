-- Create the four initial supervised Qabila rooms once. Admin may later edit or archive them.
INSERT INTO `CommunityRoom` (`id`, `programId`, `title`, `description`, `type`, `visibility`, `ageBand`, `genderScope`, `isReadOnly`, `isActive`, `createdAt`, `updatedAt`)
SELECT 'default-girls-qabila-a', NULL, 'Girls Qabila A', 'A supervised Qabila team room for mentor-guided planning, encouragement, and safe community projects. Personal contact details and external links are blocked.', 'PROJECT_TEAM', 'STUDENTS', 'GENERAL', 'GIRLS', FALSE, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `CommunityRoom` WHERE `title` = 'Girls Qabila A' AND `type` = 'PROJECT_TEAM');

INSERT INTO `CommunityRoom` (`id`, `programId`, `title`, `description`, `type`, `visibility`, `ageBand`, `genderScope`, `isReadOnly`, `isActive`, `createdAt`, `updatedAt`)
SELECT 'default-girls-qabila-b', NULL, 'Girls Qabila B', 'A supervised Qabila team room for mentor-guided planning, encouragement, and safe community projects. Personal contact details and external links are blocked.', 'PROJECT_TEAM', 'STUDENTS', 'GENERAL', 'GIRLS', FALSE, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `CommunityRoom` WHERE `title` = 'Girls Qabila B' AND `type` = 'PROJECT_TEAM');

INSERT INTO `CommunityRoom` (`id`, `programId`, `title`, `description`, `type`, `visibility`, `ageBand`, `genderScope`, `isReadOnly`, `isActive`, `createdAt`, `updatedAt`)
SELECT 'default-boys-qabila-a', NULL, 'Boys Qabila A', 'A supervised Qabila team room for mentor-guided planning, encouragement, and safe community projects. Personal contact details and external links are blocked.', 'PROJECT_TEAM', 'STUDENTS', 'GENERAL', 'BOYS', FALSE, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `CommunityRoom` WHERE `title` = 'Boys Qabila A' AND `type` = 'PROJECT_TEAM');

INSERT INTO `CommunityRoom` (`id`, `programId`, `title`, `description`, `type`, `visibility`, `ageBand`, `genderScope`, `isReadOnly`, `isActive`, `createdAt`, `updatedAt`)
SELECT 'default-boys-qabila-b', NULL, 'Boys Qabila B', 'A supervised Qabila team room for mentor-guided planning, encouragement, and safe community projects. Personal contact details and external links are blocked.', 'PROJECT_TEAM', 'STUDENTS', 'GENERAL', 'BOYS', FALSE, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `CommunityRoom` WHERE `title` = 'Boys Qabila B' AND `type` = 'PROJECT_TEAM');

