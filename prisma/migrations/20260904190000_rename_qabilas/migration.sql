UPDATE `HouseMembership` SET `qabilaGroup` = 'Maryam bint Imran' WHERE `qabilaGroup` = 'Girls Qabila A';
UPDATE `HouseMembership` SET `qabilaGroup` = 'Khadijah bint Khuwaylid' WHERE `qabilaGroup` = 'Girls Qabila B';
UPDATE `HouseMembership` SET `qabilaGroup` = 'Abubakr ibn Abi Qahafa' WHERE `qabilaGroup` = 'Boys Qabila A';
UPDATE `HouseMembership` SET `qabilaGroup` = 'Umar Ibn Al Khattab' WHERE `qabilaGroup` = 'Boys Qabila B';

UPDATE `CommunityRoom` SET `title` = 'Maryam bint Imran' WHERE `title` = 'Girls Qabila A' AND `type` = 'PROJECT_TEAM';
UPDATE `CommunityRoom` SET `title` = 'Khadijah bint Khuwaylid' WHERE `title` = 'Girls Qabila B' AND `type` = 'PROJECT_TEAM';
UPDATE `CommunityRoom` SET `title` = 'Abubakr ibn Abi Qahafa' WHERE `title` = 'Boys Qabila A' AND `type` = 'PROJECT_TEAM';
UPDATE `CommunityRoom` SET `title` = 'Umar Ibn Al Khattab' WHERE `title` = 'Boys Qabila B' AND `type` = 'PROJECT_TEAM';