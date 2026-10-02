import "server-only";
import type { PayrollInput, PayrollLine } from "./calculation";
export const SEPTEMBER_SOURCE = "https://docs.google.com/spreadsheets/d/1BUdE9iQDWEahKu9W3A7sg6_zgzgKLK9pkvkeRjfYKnw/edit?gid=1542663915";
export const STANDARD_RATES = { arabic: "5.30110263", seerah: "6.62637829", life: "5.30110263" };
const line = (label: string, sessions: number, actualMinutes: number, hourlyRate = STANDARD_RATES.arabic): PayrollLine => ({label,sessions,paidHours:String(sessions),hourlyRate,actualMinutes});
export const SEPTEMBER_TEMPLATES = [
 {key:"mehran",name:"Sir Mehran",aliases:["mehran raziq","mehran tahir"],emails:["mehranraziq@gmail.com"],lines:[line("Arabic / Tajweed",13,1093),line("Seerah & Parental sessions",9,878,STANDARD_RATES.seerah)]},
 {key:"afira",name:"Mam Afira",aliases:["afira tahir"],emails:["shoaibmufti11221122@gmail.com"],lines:[line("Arabic / Tajweed",13,714)]},
 {key:"abubakar",name:"Abubakar",aliases:["abubakar sadique","abubakr sadique","abubakar siddique"],emails:["abubakar98114@gmail.com"],lines:[line("Arabic / Tajweed",14,737)]},
 {key:"abdulbadee",name:"Abdulbadee",aliases:["abdul badee","abdulbadee","abdul badi"],emails:[],lines:[line("Advanced Arabic / Tajweed",28,1862)]},
 {key:"saba",name:"Sister Saba",aliases:["saba abdissamee","sabah abdissamee","saba abdus samee"],emails:[],lines:[line("Seerah & Parental sessions",2,161,STANDARD_RATES.seerah)]},
 {key:"javeria",name:"Javeria Khuram",aliases:["javeria khuram","javeria khurram"],emails:["javeriabasir0@gmail.com"],lines:[line("Life Skills",8,452)]},
];
export function septemberTemplate(user: {firstName:string;lastName:string;email:string}) {
 const name = (user.firstName + " " + user.lastName).trim().toLowerCase().replace(/\s+/g," ");
 return SEPTEMBER_TEMPLATES.find(t=>t.emails.includes(user.email.toLowerCase()) || t.aliases.includes(name));
}
export function emptyPayroll(lines: PayrollLine[], september = false): PayrollInput {
 return {lines,showPkr:september,fxRate:september?"375.116":"",fxDate:september?"2026-09-14":"",paidOn:"",paymentReference:"",note:"",sourceNote:september?"September payroll reference, reviewed 2 October 2026":"Proposed from the monthly hours log; review before publishing",adjustment:"0",adjustmentReason:""};
}
