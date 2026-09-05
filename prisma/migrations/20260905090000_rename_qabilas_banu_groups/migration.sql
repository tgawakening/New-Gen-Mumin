-- Move every historical and current label to the client-approved Qabila names.
UPDATE `HouseMembership` SET `qabilaGroup` = 'Qabila Banu Makhzum' WHERE `qabilaGroup` IN ('Girls Qabila A', 'Maryam bint Imran');
UPDATE `HouseMembership` SET `qabilaGroup` = 'Qabila Banu Zuhra' WHERE `qabilaGroup` IN ('Girls Qabila B', 'Khadijah bint Khuwaylid');
UPDATE `HouseMembership` SET `qabilaGroup` = 'Qabila Banu Hashim' WHERE `qabilaGroup` IN ('Boys Qabila A', 'Abubakr ibn Abi Qahafa');
UPDATE `HouseMembership` SET `qabilaGroup` = 'Qabila Banu Asad' WHERE `qabilaGroup` IN ('Boys Qabila B', 'Umar Ibn Al Khattab');

UPDATE `CommunityRoom` SET `title` = 'Qabila Banu Makhzum' WHERE `title` IN ('Girls Qabila A', 'Maryam bint Imran') AND `type` = 'PROJECT_TEAM';
UPDATE `CommunityRoom` SET `title` = 'Qabila Banu Zuhra' WHERE `title` IN ('Girls Qabila B', 'Khadijah bint Khuwaylid') AND `type` = 'PROJECT_TEAM';
UPDATE `CommunityRoom` SET `title` = 'Qabila Banu Hashim' WHERE `title` IN ('Boys Qabila A', 'Abubakr ibn Abi Qahafa') AND `type` = 'PROJECT_TEAM';
UPDATE `CommunityRoom` SET `title` = 'Qabila Banu Asad' WHERE `title` IN ('Boys Qabila B', 'Umar Ibn Al Khattab') AND `type` = 'PROJECT_TEAM';

-- Keep the two named test learners in their requested Qabilas after the rename.
UPDATE `HouseMembership` hm
JOIN `StudentProfile` sp ON sp.`id` = hm.`studentId`
JOIN `User` u ON u.`id` = sp.`userId`
SET hm.`qabilaGroup` = 'Qabila Banu Hashim', hm.`role` = 'MEMBER'
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) IN ('ahmad', 'ahmad parent')
   OR (LOWER(TRIM(u.`firstName`)) = 'ahmad' AND LOWER(TRIM(COALESCE(u.`lastName`, ''))) IN ('', 'parent'));

UPDATE `HouseMembership` hm
JOIN `StudentProfile` sp ON sp.`id` = hm.`studentId`
JOIN `User` u ON u.`id` = sp.`userId`
SET hm.`qabilaGroup` = 'Qabila Banu Zuhra', hm.`role` = 'MEMBER'
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) IN ('khadija', 'khadija parent', 'khadjia', 'khadjia parent')
   OR (LOWER(TRIM(u.`firstName`)) IN ('khadija', 'khadjia') AND LOWER(TRIM(COALESCE(u.`lastName`, ''))) IN ('', 'parent'));