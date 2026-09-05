-- Keep the testing learner's public identity consistent across dashboards,
-- Qabila membership lists, chat messages, mentions, and reward views.
UPDATE `StudentProfile` sp
JOIN `User` u ON u.`id` = sp.`userId`
SET sp.`displayName` = 'Khadija',
    u.`firstName` = 'Khadija',
    u.`lastName` = ''
WHERE LOWER(TRIM(COALESCE(sp.`displayName`, ''))) IN ('khadija parent', 'khadjia parent', 'khadjia')
   OR (LOWER(TRIM(u.`firstName`)) IN ('khadija', 'khadjia')
       AND LOWER(TRIM(COALESCE(u.`lastName`, ''))) = 'parent');
