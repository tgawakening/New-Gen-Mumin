const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {randomBytes}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const db=new PrismaClient();
const sessions=[];let browser;
(async()=>{try{
 const base='http://localhost:3097';
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 let status='WAITING',round=null,joined=false,response=null,answersPosted=0,roomGets=0,activeGets=0;
 const q={id:'q1',prompt:'Which answer is A?',type:'MCQ',points:1,choices:['A','B']};
 const parentContext=await browser.newContext({viewport:{width:390,height:844}}),teacherContext=await browser.newContext({viewport:{width:1280,height:900}});
 const parent=await parentContext.newPage(),teacher=await teacherContext.newPage();const errors=[];
 for(const [context,page,role,where] of [[parentContext,parent,'PARENT',{role:'PARENT',status:'ACTIVE',firstName:{contains:'Areej'}}],[teacherContext,teacher,'TEACHER',{email:'mehranraziq@gmail.com',status:'ACTIVE'}]]){
  const user=await db.user.findFirst({where,select:{id:true}});assert.ok(user);
  const session=await db.session.create({data:{userId:user.id,sessionToken:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+300000)}});sessions.push(session.id);
  await context.addCookies([{name:'gen_mumins_session',value:session.sessionToken,url:base}]);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/quizzes/live/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   const fulfill=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname.endsWith('/active')){activeGets++;return fulfill({quizzes:status==='ENDED'?[]:[{sessionId:'browser-test',studentId:'browser-child',childName:'Test learner',title:'Browser test quiz',status}]});}
   if(req.method()==='POST'){
    const input=req.postDataJSON();
    if(input.action==='join'){joined=true;return fulfill({studentId:'browser-child'});}
    if(input.action==='open'||input.action==='reopen'){status='LIVE';round=new Date().toISOString();return fulfill({ok:true});}
    if(input.action==='answer'){answersPosted++;await new Promise(r=>setTimeout(r,800));response={questionId:'q1',answer:input.answer,correct:true,points:1,seconds:2};return fulfill({response});}
    if(input.action==='end'){status='ENDED';return fulfill({ok:true});}
    return fulfill({ok:true});
   }
   roomGets++;
   return fulfill({id:'browser-test',title:'Browser test quiz',status,serverNow:new Date().toISOString(),round,questionId:status==='LIVE'?'q1':null,duration:60,deadline:round?new Date(Date.parse(round)+60000).toISOString():null,questionCount:1,questionNumber:round?1:0,question:status==='LIVE'?q:null,response:role==='PARENT'?response:null,responses:response?[response]:[],bonus:0,...(role==='PARENT'?{learner:{id:'browser-child',name:'Test learner',avatar:null}}:{questions:[q],roster:[{id:'browser-child',name:'Test learner',avatar:null,house:'Test Qabila',joined,answer:response}],teams:response?[{name:'Test Qabila',points:1}]:[]})});
  });
 }
 await parent.goto(base+'/parent/add-child',{waitUntil:'domcontentloaded',timeout:60000});
 await parent.getByRole('link',{name:/Test learner: Browser test quiz/}).waitFor({timeout:15000});
 await parent.getByRole('link',{name:/Test learner: Browser test quiz/}).click();
 await parent.getByRole('heading',{name:'You are in! Waiting for your teacher.'}).waitFor({timeout:15000});
 assert.equal(await parent.getByRole('complementary',{name:'Live quiz invitation'}).count(),0);
 await teacher.goto(base+'/teacher/quizzes/live/browser-test',{waitUntil:'domcontentloaded',timeout:30000});
 await teacher.getByText('1 learners joined / 1 invited').waitFor({timeout:10000});
 const started=Date.now();await teacher.getByRole('button',{name:'Open question 1'}).click();
 await parent.getByRole('heading',{name:q.prompt}).waitFor({timeout:6000});const questionMs=Date.now()-started;
 await parent.getByRole('radio',{name:'A',exact:true}).check();await parent.getByRole('button',{name:'Submit answer',exact:true}).click();
 assert.equal(await parent.getByRole('button',{name:'Saving answer...'}).isDisabled(),true);
 await parent.getByText('Answer saved: A. Wait for the next question.').waitFor({timeout:6000});
 await teacher.getByText('1 answers received').waitFor({timeout:6000});assert.equal(answersPosted,1);
 assert.ok(await parent.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile horizontal overflow');
 await parent.screenshot({path:process.env.TEMP+'/genm-live-quiz-mobile.png',fullPage:true});
 await teacher.getByRole('button',{name:'Reopen timer'}).click();
 await parent.getByText('Answer saved: A. Wait for the next question.').waitFor();assert.equal(answersPosted,1);
 await parent.goto(base+'/parent/policies',{waitUntil:'domcontentloaded',timeout:60000});await parent.waitForTimeout(4000);
 assert.equal(await parent.getByRole('complementary',{name:'Live quiz invitation'}).count(),0,'Visited quiz should not repeatedly prompt on other pages');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({passed:true,questionAppearedMs:questionMs,answersPosted,roomGets,activeGets,mobileOverflow:false,browserErrors:errors.length}));
}finally{if(browser)await browser.close();await db.session.deleteMany({where:{id:{in:sessions}}});await db.$disconnect();}})().catch(error=>{console.error(error);process.exitCode=1;});
