import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,scryptSync} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const email='emancheman413@gmail.com';
const db=new PrismaClient();
try {
 const existing=await db.user.findUnique({where:{email},select:{id:true,role:true,status:true}});
 console.log(JSON.stringify({email,existing}));
 if(process.argv.includes('--apply')) {
  if(existing){if(existing.role!=='COMMUNICATIONS')throw new Error('Existing account has another role; do not overwrite.');console.log('Communications account already exists; password left unchanged.');}
  else {
   const probe=await fetch('https://genmumin.com/communications',{redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(probe.status!==307 || !probe.headers.get('location')?.includes('/auth/login')) throw new Error('Deploy the communications portal before creating its role account.');
   const target=process.env.MALIHA_CREDENTIAL_FILE;
   if(!target||!path.isAbsolute(target)||!path.resolve(target).startsWith(path.resolve(process.env.TEMP)+path.sep))throw new Error('Use an absolute private TEMP path for MALIHA_CREDENTIAL_FILE.');
   const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
   const passwordHash=salt+':'+scryptSync(password,salt,64).toString('hex');
   fs.writeFileSync(target,'Maliha - Gen-Mumin Communications Lead\nLogin: https://genmumin.com/auth/login\nPortal: https://genmumin.com/communications\nEmail: '+email+'\nInitial password: '+password+'\n\nUse Forgot password on the login page to choose a personal password.\n',{flag:'wx',mode:0o600});
   try {await db.user.create({data:{email,firstName:'Maliha',lastName:'',role:'COMMUNICATIONS',status:'ACTIVE',passwordHash,timezone:null}});}catch(e){fs.unlinkSync(target);throw e;}
   console.log(JSON.stringify({created:true,email,role:'COMMUNICATIONS',credentialsFile:target}));
  }
 }
}finally{await db.$disconnect();}
