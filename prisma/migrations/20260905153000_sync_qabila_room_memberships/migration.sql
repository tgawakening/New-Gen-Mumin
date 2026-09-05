-- Populate Qabila community rooms from the authoritative House/Qabila allocations.
INSERT IGNORE INTO `CommunityMembership` (`id`, `roomId`, `studentId`, `role`, `joinedAt`)
SELECT CONCAT('qsync_', REPLACE(UUID(), '-', '')), room.`id`, hm.`studentId`, COALESCE(NULLIF(hm.`role`, ''), 'MEMBER'), CURRENT_TIMESTAMP(3)
FROM `HouseMembership` hm
JOIN `CommunityRoom` room
  ON room.`title` = hm.`qabilaGroup`
 AND room.`type` = 'PROJECT_TEAM'
 AND room.`isActive` = TRUE
WHERE hm.`qabilaGroup` IN ('Qabila Banu Makhzum', 'Qabila Banu Zuhra', 'Qabila Banu Hashim', 'Qabila Banu Asad');

-- Keep displayed Qabila roles aligned with the allocation source.
UPDATE `CommunityMembership` cm
JOIN `CommunityRoom` room ON room.`id` = cm.`roomId` AND room.`type` = 'PROJECT_TEAM'
JOIN `HouseMembership` hm ON hm.`studentId` = cm.`studentId` AND hm.`qabilaGroup` = room.`title`
SET cm.`role` = COALESCE(NULLIF(hm.`role`, ''), 'MEMBER')
WHERE room.`title` IN ('Qabila Banu Makhzum', 'Qabila Banu Zuhra', 'Qabila Banu Hashim', 'Qabila Banu Asad');