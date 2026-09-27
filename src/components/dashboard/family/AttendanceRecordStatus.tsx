import { attendanceTotals } from "@/lib/live-classes/attendance-summary";
export function AttendanceRecordStatus({records,reports}:{records:Array<{status:string}>;reports:Array<{fromDay:string;toDay:string;missedCount:number}>}){
 const totals=attendanceTotals(records,reports);
 if(!totals.pending&&!reports.length)return null;
 return <section className={`space-y-2 rounded-2xl border p-4 ${totals.pending?'border-amber-300 bg-amber-50':'border-green-200 bg-green-50'}`}>
  {totals.pending?<><h2 className="font-semibold">Attendance still needs confirmation</h2><p>{totals.present} attended; {totals.pending} sessions still unconfirmed. {totals.rate!==null?`${totals.rate}% applies only to confirmed classes; it does not mean every listed session is marked present.`:'Your attendance percentage will appear after classes are confirmed.'}</p></>:<h2 className="font-semibold">All listed sessions have an attendance status</h2>}
  {reports.length?<p className="text-sm">Saved admin correction periods: {reports.map(report=>`${report.fromDay} to ${report.toDay}`).join('; ')}. Classes outside these periods keep their own status.</p>:<p className="text-sm">No completed admin attendance correction is recorded for this learner yet. Selecting All attended does not change records until saving succeeds.</p>}
 </section>;
}
