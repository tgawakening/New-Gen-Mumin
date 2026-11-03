import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration=fs.readFileSync('prisma/migrations/20261103140000_correct_muntaha_student_name/migration.sql','utf8').replace('START TRANSACTION;','BEGIN;');
test('Muntaha placeholder is corrected in stored student, registration and certificate names without renaming parents or other students',()=>{
  const db=new DatabaseSync(':memory:');db.function('CONCAT',(...values)=>values.join(''));
  try{
    db.exec(`CREATE TABLE User(id TEXT,role TEXT,firstName TEXT,lastName TEXT);
      CREATE TABLE StudentProfile(id TEXT,userId TEXT,displayName TEXT);
      CREATE TABLE RegistrationStudent(id TEXT,studentProfileId TEXT,firstName TEXT,lastName TEXT,displayName TEXT);
      CREATE TABLE RecognitionAward(id TEXT,studentId TEXT,recipientName TEXT);
      INSERT INTO User VALUES('learner','STUDENT','Muntaha','Parent'),('parent','PARENT','Muntaha','Parent'),('other','STUDENT','Muntaha','Ali'),('conflict','STUDENT','Muntaha','Parent');
      INSERT INTO StudentProfile VALUES('child','learner','Muntaha Parent'),('legacy','parent','Muntaha Parent'),('other-child','other','Muntaha Ali'),('conflict-child','conflict','Different Child');
      INSERT INTO RegistrationStudent VALUES('registration','child','Muntaha','Parent','Muntaha Parent'),('other-registration','other-child','Muntaha','Ali','Muntaha Ali'),('unlinked',NULL,'Muntaha','Parent','Muntaha Parent');
      INSERT INTO RecognitionAward VALUES('certificate','child','Muntaha Parent'),('custom-certificate','child','Muntaha Fatima'),('other-certificate','other-child','Muntaha Parent');`);
    db.exec(migration);
    assert.equal(db.prepare("SELECT displayName FROM StudentProfile WHERE id='child'").get().displayName,'Muntaha Fatima');
    assert.equal(db.prepare("SELECT displayName FROM StudentProfile WHERE id='legacy'").get().displayName,'Muntaha Fatima');
    assert.deepEqual({...db.prepare("SELECT firstName,lastName FROM User WHERE id='learner'").get()},{firstName:'Muntaha',lastName:'Fatima'});
    assert.equal(db.prepare("SELECT lastName FROM User WHERE id='parent'").get().lastName,'Parent');
    assert.equal(db.prepare("SELECT lastName FROM User WHERE id='conflict'").get().lastName,'Parent');
    assert.equal(db.prepare("SELECT displayName FROM RegistrationStudent WHERE id='registration'").get().displayName,'Muntaha Fatima');
    assert.equal(db.prepare("SELECT displayName FROM RegistrationStudent WHERE id='unlinked'").get().displayName,'Muntaha Parent');
    assert.equal(db.prepare("SELECT recipientName FROM RecognitionAward WHERE id='certificate'").get().recipientName,'Muntaha Fatima');
    assert.equal(db.prepare("SELECT recipientName FROM RecognitionAward WHERE id='other-certificate'").get().recipientName,'Muntaha Parent');
    const before=db.prepare('SELECT * FROM StudentProfile ORDER BY id').all();db.exec(migration);
    assert.deepEqual(db.prepare('SELECT * FROM StudentProfile ORDER BY id').all(),before);
    assert.equal(db.prepare("SELECT displayName FROM StudentProfile WHERE id='other-child'").get().displayName,'Muntaha Ali');
  }finally{db.close();}
});
