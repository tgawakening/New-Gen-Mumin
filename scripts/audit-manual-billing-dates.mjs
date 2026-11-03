import { PrismaClient } from '@prisma/client';
const raw=process.env.APP_DATABASE_URL||process.env.GEN_MUMIN_DATABASE_URL||process.env.DATABASE_URL;
if(!raw)throw new Error('Run this read-only audit in the deployed application console. Do not paste credentials.');
const url=raw.trim().replace(/^["']|["']$/g,'').replace(/ssl-mode=REQUIRED/gi,'sslaccept=accept_invalid_certs');
const db=new PrismaClient({datasources:{db:{url}}});
try{
 const rows=await db.monthlyPaymentRecord.findMany({where:{method:'MANUAL',status:{in:['PENDING','FAILED']},billingPeriodEnd:{gt:new Date('2026-11-01')}},include:{parent:{include:{user:true}},student:true},orderBy:[{dueDate:'asc'},{childName:'asc'}],take:1000});
 const records=rows.map(row=>({recordId:row.id,child:row.childName,parent:[row.parent.user.firstName,row.parent.user.lastName].filter(Boolean).join(' '),status:row.status,month:row.monthKey,country:row.student.countryCode||row.student.countryName||row.parent.billingCountryCode||row.parent.billingCountryName||null,dueDate:row.dueDate,manualSchedule:row.metadata&&typeof row.metadata==='object'?row.metadata.manualBillingSchedule||null:null}));
 console.log(JSON.stringify({mode:'read-only',limit:1000,records,scheduledRecords:records.filter(row=>row.manualSchedule).length},null,2));
}catch{console.error('Could not read billing dates. Check the live deployment and database connection. No records were changed.');process.exitCode=1;}finally{await db.$disconnect();}
