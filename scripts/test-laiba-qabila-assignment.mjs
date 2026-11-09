import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration = fs.readFileSync('scripts/sql/assign-laiba-girls-qabila.sql', 'utf8');
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.function('CONCAT', (...values) => values.join(''));
  db.function('NOW', () => '2026-11-09 12:00:00');
  const schema = `
CREATE TABLE User(id VARCHAR(191) PRIMARY KEY, firstName VARCHAR(191), lastName VARCHAR(191), email VARCHAR(191), role VARCHAR(191), status VARCHAR(191));
CREATE TABLE StudentProfile(id VARCHAR(191) PRIMARY KEY, userId VARCHAR(191), displayName VARCHAR(191), createdAt VARCHAR(191));
CREATE TABLE ParentProfile(id VARCHAR(191) PRIMARY KEY, userId VARCHAR(191));
CREATE TABLE ParentStudent(id VARCHAR(191) PRIMARY KEY, studentId VARCHAR(191), parentId VARCHAR(191), relation VARCHAR(191), createdAt VARCHAR(191));
CREATE TABLE Registration(id VARCHAR(191) PRIMARY KEY, parentProfileId VARCHAR(191), status VARCHAR(191), parentEmail VARCHAR(191), parentFirstName VARCHAR(191), parentLastName VARCHAR(191), createdAt VARCHAR(191));
CREATE TABLE RegistrationStudent(id VARCHAR(191) PRIMARY KEY, studentProfileId VARCHAR(191), registrationId VARCHAR(191), firstName VARCHAR(191), lastName VARCHAR(191));
CREATE TABLE Enrollment(id VARCHAR(191) PRIMARY KEY, studentId VARCHAR(191), status VARCHAR(191));
CREATE TABLE House(id VARCHAR(191) PRIMARY KEY, slug VARCHAR(191), name VARCHAR(191), virtue VARCHAR(191), color VARCHAR(191), sortOrder INT, createdAt VARCHAR(191), updatedAt VARCHAR(191));
CREATE TABLE HouseMembership(id VARCHAR(191) PRIMARY KEY, studentId VARCHAR(191) UNIQUE, houseId VARCHAR(191), qabilaGroup VARCHAR(191), role VARCHAR(191), joinedAt VARCHAR(191));
CREATE TABLE CommunityRoom(id VARCHAR(191) PRIMARY KEY, title VARCHAR(191), description VARCHAR(500), type VARCHAR(191), visibility VARCHAR(191), ageBand VARCHAR(191), genderScope VARCHAR(191), isReadOnly INT, isActive INT, createdAt VARCHAR(191), updatedAt VARCHAR(191));
CREATE TABLE CommunityMembership(id VARCHAR(191) PRIMARY KEY, roomId VARCHAR(191), studentId VARCHAR(191), role VARCHAR(191), joinedAt VARCHAR(191), UNIQUE(roomId,studentId));
CREATE TABLE HousePointLedger(id VARCHAR(191) PRIMARY KEY, studentId VARCHAR(191), points INT);
CREATE TABLE Notification(id VARCHAR(191) PRIMARY KEY);
INSERT INTO House VALUES('house','blue-house','Blue House','Wisdom','#2563eb',4,'2026-01-01','2026-01-01');
INSERT INTO Notification VALUES('existing-notice');`;
  db.exec(schema);
  function add(id, { mother = 'Anum Sheikh', email = 'anum@example.test', name = 'Laiba', qabila = null, role = 'MEMBER', registration = 'CONVERTED', enrollment = 'ACTIVE', date = '2026-10-01', status = 'ACTIVE', link = true } = {}) {
    const parentId = 'parent-' + email;
    const [firstName, ...rest] = mother.split(' ');
    if (!db.prepare('SELECT id FROM ParentProfile WHERE id=?').get(parentId)) {
      db.prepare('INSERT INTO User VALUES(?,?,?,?,?,?)').run(parentId, firstName, rest.join(' '), email, 'PARENT', 'ACTIVE');
      db.prepare('INSERT INTO ParentProfile VALUES(?,?)').run(parentId, parentId);
    }
    db.prepare('INSERT INTO User VALUES(?,?,?,?,?,?)').run('user-'+id, name, '', id+'@student.test', 'STUDENT', status);
    db.prepare('INSERT INTO StudentProfile VALUES(?,?,?,?)').run(id, 'user-'+id, name, date);
    if (link) db.prepare('INSERT INTO ParentStudent VALUES(?,?,?,?,?)').run('link-'+id, id, parentId, 'CHILD', date);
    db.prepare('INSERT INTO Registration VALUES(?,?,?,?,?,?,?)').run('reg-'+id, parentId, registration, email, firstName, rest.join(' '), date);
    db.prepare('INSERT INTO RegistrationStudent(id,studentProfileId,registrationId,firstName) VALUES(?,?,?,?)').run('rs-'+id, id, 'reg-'+id, name);
    db.prepare('INSERT INTO Enrollment VALUES(?,?,?)').run('enrol-'+id, id, enrollment);
    if (qabila) db.prepare('INSERT INTO HouseMembership VALUES(?,?,?,?,?,?)').run('hm-'+id, id, 'house', qabila, role, date);
  }
  function girls(a,b) {
    for (const [qabila,count] of [['Qabila Banu Makhzum',a],['Qabila Banu Zuhra',b]]) for(let i=0;i<count;i++) add(qabila+i,{ mother:'Other Mother', email:'other@example.test', name:'Girl '+qabila+i, qabila });
  }
  const apply = () => db.exec(migration.replaceAll(' COLLATE utf8mb4_unicode_ci','').replaceAll('TEMPORARY TABLE','TEMP TABLE').replaceAll('DROP TEMP TABLE','DROP TABLE').replace('START TRANSACTION','BEGIN TRANSACTION'));
  return { db, schema, add, girls, apply };
}
for (const [a,b,expected] of [[3,1,'Qabila Banu Zuhra'],[1,3,'Qabila Banu Makhzum'],[2,2,'Qabila Banu Makhzum'],[0,0,'Qabila Banu Makhzum']]) test(`Laiba joins the smaller girls Qabila (${a}/${b}), with deterministic ties`, () => {
  const f=fixture();try{f.add('laiba');f.girls(a,b);f.db.exec("INSERT INTO HousePointLedger VALUES('old-points','laiba',80)");f.apply();
    assert.equal(f.db.prepare('SELECT qabilaGroup FROM HouseMembership WHERE studentId=?').get('laiba').qabilaGroup,expected);
    const room=f.db.prepare('SELECT r.* FROM CommunityRoom r JOIN CommunityMembership m ON m.roomId=r.id WHERE m.studentId=?').get('laiba');
    assert.equal(room.title,expected);assert.equal(room.genderScope,'GIRLS');assert.equal(room.isActive,1);
    assert.equal(f.db.prepare('SELECT SUM(points) AS total FROM HousePointLedger').get().total,80);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM Notification').get().n,1);
    f.apply();assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM CommunityMembership WHERE studentId=?').get('laiba').n,1);
  }finally{f.db.close();}
});
test('same-name students in another family and pending/suspended accounts are never assigned',()=>{
 const f=fixture();try{f.add('wrong',{mother:'Other Mother',email:'other@example.test'});f.add('pending',{registration:'PAYMENT_REVIEW'});f.add('suspended',{status:'SUSPENDED'});f.apply();assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM HouseMembership').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM CommunityRoom').get().n,0);}finally{f.db.close();}
});
test('ambiguous same-name mother/child pairs in different families are left for review',()=>{
 const f=fixture();try{f.add('first');f.add('second',{email:'other-anum@example.test'});f.apply();assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM HouseMembership').get().n,0);}finally{f.db.close();}
});
test('newest approved profile wins and an existing girls assignment is preserved',()=>{
 const f=fixture();try{f.add('old',{date:'2026-09-01'});f.add('new',{date:'2026-10-01',qabila:'Qabila Banu Zuhra',role:'VICE_CAPTAIN'});f.girls(1,4);f.apply();assert.equal(f.db.prepare('SELECT qabilaGroup,role FROM HouseMembership WHERE studentId=?').get('new').qabilaGroup,'Qabila Banu Zuhra');assert.equal(f.db.prepare('SELECT role FROM HouseMembership WHERE studentId=?').get('new').role,'VICE_CAPTAIN');assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM HouseMembership WHERE studentId=?').get('old').n,0);}finally{f.db.close();}
});
test('Anum Shaikh spelling and missing parent link are recovered from the approved registration',()=>{
 const f=fixture();try{f.add('laiba',{mother:'Anum Shaikh',link:false});f.apply();assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM ParentStudent WHERE studentId=?').get('laiba').n,1);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM CommunityMembership WHERE studentId=?').get('laiba').n,1);}finally{f.db.close();}
});
test('moving from a boys room removes only stale Qabila access and keeps other rooms',()=>{
 const f=fixture();try{f.add('laiba',{qabila:'Qabila Banu Hashim',role:'CAPTAIN'});f.db.exec("INSERT INTO CommunityRoom(id,title,type,isActive) VALUES('boys','Qabila Banu Hashim','PROJECT_TEAM',1),('general','Announcements','ANNOUNCEMENT',1);INSERT INTO CommunityMembership VALUES('old','boys','laiba','MEMBER','2026-01-01'),('announcement','general','laiba','MEMBER','2026-01-01')");f.apply();assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM CommunityMembership WHERE roomId=?').get('boys').n,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM CommunityMembership WHERE roomId=?').get('general').n,1);assert.equal(f.db.prepare('SELECT role FROM HouseMembership WHERE studentId=?').get('laiba').role,'MEMBER');}finally{f.db.close();}
});
// The same fixture schema is used for an additional MySQL 8 check during development.
export { fixture, migration };

test('duplicate paid accounts do not inflate girls Qabila counts',()=>{
 const f=fixture();try{f.add('laiba');for(let i=0;i<3;i++)f.add('duplicate'+i,{mother:'Other Mother',email:'other@example.test',name:'Same Girl',qabila:'Qabila Banu Makhzum',date:'2026-10-0'+(i+1)});f.girls(0,2);f.apply();assert.equal(f.db.prepare('SELECT qabilaGroup FROM HouseMembership WHERE studentId=?').get('laiba').qabilaGroup,'Qabila Banu Makhzum');}finally{f.db.close();}
});
