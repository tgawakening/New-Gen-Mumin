import assert from 'node:assert/strict';
import test from 'node:test';
import { currentRecognitionWeek,validRecognitionWeek,recognitionMonthWeeks,recognitionWeekLabel } from '../src/lib/community/recognition-week.ts';
const now=new Date('2026-10-03T10:00:00Z');
test('current and previous weeks remain separate across September/October',()=>{assert.equal(currentRecognitionWeek(now),'2026-09-28');assert.ok(validRecognitionWeek('2026-09-21',now));assert.ok(validRecognitionWeek('2026-09-28',now));assert.equal(recognitionMonthWeeks('2026-10','2026-09-28')[0].value,'2026-09-28');assert.equal(recognitionMonthWeeks('2026-09','2026-09-28').at(-1).value,'2026-09-28');});
test('Pakistan Monday starts while UTC is still Sunday',()=>{assert.equal(currentRecognitionWeek(new Date('2026-10-04T19:00:00Z')),'2026-10-05');assert.equal(currentRecognitionWeek(new Date('2026-10-04T18:59:59Z')),'2026-09-28');});
test('future, malformed and non-Monday periods are rejected',()=>{for(const value of ['2026-10-05','2026-09-29','2026-02-30','2026-13-01','',null])assert.equal(validRecognitionWeek(value,now),false);});
test('month ranges include overlapping weeks without creating another period identity',()=>{const weeks=recognitionMonthWeeks('2026-08','2026-09-28');assert.equal(weeks.length,6);assert.equal(weeks[0].value,'2026-07-27');assert.equal(weeks.at(-1).value,'2026-08-31');assert.deepEqual(recognitionMonthWeeks('invalid','2026-09-28'),[]);});
test('printed labels include both dates and the year',()=>{assert.equal(recognitionWeekLabel('2026-09-28'),'28 Sept 2026 - 4 Oct 2026');assert.match(recognitionWeekLabel('2025-12-29'),/2025.*2026/);});
