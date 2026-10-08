import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PrismaClient } from '@prisma/client';
function load(file,deps={}) { const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require:id=>{if(id in deps)return deps[id];throw Error(id);}});return exports; }
const {hasScheduleEnded}=load('src/lib/live-classes/schedule-lifecycle.ts');
const now=Date.now();assert.equal(hasScheduleEnded({endsOn:null},now),false);assert.equal(hasScheduleEnded({endsOn:new Date(now+1)},now),false);assert.equal(hasScheduleEnded({endsOn:new Date(now)},now),true);assert.equal(hasScheduleEnded({endsOn:new Date(now-1)},now),true);
if(!process.env.DATABASE_URL) throw Error('DATABASE_URL required for rollback-only archival regression test');
const db=new PrismaClient();let scheduleId;
const rollback=new Error('ROLLBACK_ARCHIVE_TEST');
try {
 await db.$transaction(async tx=>{
  const teacher=await tx.teacherProfile.findFirst({select:{id:true}});
  const enrollment=await tx.enrollment.findFirst({select:{id:true,studentId:true,programId:true}});
  assert.ok(teacher&&enrollment);
  const schedule=await tx.classSchedule.create({data:{teacherId:teacher.id,programId:enrollment.programId,title:'Rollback-only archive regression',weekday:1,startTime:'12:00',endTime:'13:00'}});scheduleId=schedule.id;
  await tx.liveClassRecording.create({data:{scheduleId,playUrl:'https://example.invalid/test-recording',topic:'Historical recording'}});
  await tx.classScheduleRoster.create({data:{scheduleId,studentId:enrollment.studentId}});
  await tx.liveClassSessionOccurrence.create({data:{scheduleId,occurrenceDate:new Date(),startedAt:new Date(),source:'rollback-test'}});
  await tx.attendanceRecord.create({data:{scheduleId,enrollmentId:enrollment.id,studentId:enrollment.studentId,lessonDate:new Date(),status:'PRESENT',source:'rollback-test'}});
  const {archiveClassSchedule}=load('src/lib/live-classes/archive.ts',{'server-only':{},'@/lib/db':{db:tx}});
  await archiveClassSchedule(scheduleId);
  const first=await tx.classSchedule.findUniqueOrThrow({where:{id:scheduleId},include:{_count:{select:{recordings:true,attendances:true,sessionOccurrences:true,scheduleRosters:true}}}});
  assert.equal(hasScheduleEnded(first),true);
  assert.deepEqual(first._count,{recordings:1,attendances:1,sessionOccurrences:1,scheduleRosters:1});
  await archiveClassSchedule(scheduleId);
  const second=await tx.classSchedule.findUniqueOrThrow({where:{id:scheduleId}});assert.equal(second.endsOn.getTime(),first.endsOn.getTime());
  console.log('PASS: archiving preserves recording, attendance, occurrence and roster; repeated archive does not extend schedule.');
  throw rollback;
 },{timeout:20000});
} catch(error) {if(error!==rollback)throw error;}
finally { if(scheduleId)assert.equal(await db.classSchedule.count({where:{id:scheduleId}}),0,'Regression data must be rolled back'); await db.$disconnect(); }
console.log('PASS: rollback verified; no test records retained.');
