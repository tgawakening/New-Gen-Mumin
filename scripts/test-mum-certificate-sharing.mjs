import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration = fs.readFileSync('prisma/migrations/20261103100000_share_mum_certificate_points/migration.sql','utf8')
  .replace('START TRANSACTION;','BEGIN;').replaceAll('150 DIV','150 /');
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.function('CONCAT',(...values)=>values.join('')); db.function('MOD',(a,b)=>a%b);
  db.exec(`CREATE TABLE HousePointLedger(id TEXT PRIMARY KEY, houseId TEXT, studentId TEXT, points INT, reason TEXT, sourceType TEXT, sourceId TEXT, awardedAt TEXT, UNIQUE(studentId,sourceType,sourceId));
    CREATE TABLE HouseMembership(studentId TEXT UNIQUE, houseId TEXT, qabilaGroup TEXT);
    CREATE TABLE ParentStudent(parentId TEXT, studentId TEXT, UNIQUE(parentId,studentId));
    CREATE TABLE ParentRecognitionAward(id TEXT, parentId TEXT, pointsStudentId TEXT, badgeKey TEXT, isPublic INT, revokedAt TEXT, awardedAt TEXT);`);
  const child = db.prepare('INSERT INTO ParentStudent VALUES(?,?)'), membership=db.prepare('INSERT INTO HouseMembership VALUES(?,?,?)');
  for (const [parent,count] of [['duo',2],['trio',3],['four',4],['single',1]]) {
    for(let i=0;i<count;i++){const id=`${parent}-${i}`;child.run(parent,id);membership.run(id,`house-${i}`,i%2?'Qabila Banu Asad':'Qabila Banu Makhzum');}
    db.prepare('INSERT INTO ParentRecognitionAward VALUES(?,?,?,?,?,?,?)').run(parent,parent,`${parent}-0`,'MUM_OF_WEEK',1,null,'2026-10-31');
    db.prepare('INSERT INTO HousePointLedger VALUES(?,?,?,?,?,?,?,?)').run(`old-${parent}`,'house-0',`${parent}-0`,150,'original','PARENT_RECOGNITION_MUM_OF_WEEK',parent,'2026-10-31');
  }
  child.run('duo','unassigned'); membership.run('unassigned','house',null);
  db.exec(`INSERT INTO ParentRecognitionAward VALUES('private','duo','duo-0','MUM_OF_WEEK',0,NULL,'2026-10-31'),('revoked','duo','duo-0','MUM_OF_WEEK',1,'2026-11-01','2026-10-31'),('other','duo','duo-0','NURTURING_MUM',1,NULL,'2026-10-31');
    INSERT INTO HousePointLedger VALUES('mumin','house','duo-0',150,'Mumin award','RECOGNITION_MUMIN_OF_WEEK','mumin-award','2026-10-31'),('badge','house','duo-0',25,'Other Mum recognition','PARENT_RECOGNITION_MUM_OF_WEEK','other','2026-10-31');`);
  return db;
}
test('existing published Mum awards are split across every assigned child while retaining 150 per family award',()=>{
  const db=fixture();try{
    db.exec(migration);
    for(const [parent,expected] of [['duo',[75,75]],['trio',[50,50,50]],['four',[38,38,37,37]],['single',[150]]]) {
      const rows=db.prepare('SELECT * FROM HousePointLedger WHERE sourceId=? ORDER BY studentId').all(parent);
      assert.deepEqual(rows.map(row=>row.points),expected);
      assert.equal(rows.reduce((sum,row)=>sum+row.points,0),150);
      assert.ok(rows.every(row=>row.awardedAt==='2026-10-31'));
      assert.equal(db.prepare('SELECT pointsStudentId FROM ParentRecognitionAward WHERE id=?').get(parent).pointsStudentId,null);
    }
    assert.equal(db.prepare("SELECT houseId FROM HousePointLedger WHERE sourceId='duo' AND studentId='duo-1'").get().houseId,'house-1');
    const qabilas = db.prepare("SELECT m.qabilaGroup, SUM(p.points) points FROM HousePointLedger p JOIN HouseMembership m ON m.studentId=p.studentId WHERE p.sourceId='duo' GROUP BY m.qabilaGroup").all();
    assert.equal(qabilas.length,2); assert.ok(qabilas.every(row=>row.points===75));
  }finally{db.close();}
});
test('rebalance is idempotent, excludes unassigned records and leaves private/revoked certificates and separate Mumin credits alone',()=>{
  const db=fixture();try{
    db.exec(migration);const before=db.prepare('SELECT * FROM HousePointLedger ORDER BY id').all();
    db.exec(migration);assert.deepEqual(db.prepare('SELECT * FROM HousePointLedger ORDER BY id').all(),before);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM HousePointLedger WHERE sourceId IN ('private','revoked') OR studentId='unassigned'").get().n,0);
    assert.equal(db.prepare("SELECT points FROM HousePointLedger WHERE id='mumin'").get().points,150);
    assert.equal(db.prepare("SELECT points FROM HousePointLedger WHERE id='badge'").get().points,25);
  }finally{db.close();}
});
