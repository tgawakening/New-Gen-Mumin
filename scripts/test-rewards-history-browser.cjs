const assert=require('node:assert/strict');const {PrismaClient}=require('@prisma/client');const {randomBytes}=require('node:crypto');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const db=new PrismaClient();let browser,session;
(async()=>{try{
 const base=process.env.SMOKE_BASE||'http://localhost:3097';
 const user=await db.user.findFirst({where:{role:'ADMIN',status:'ACTIVE'},select:{id:true}});assert.ok(user);
 session=await db.session.create({data:{userId:user.id,sessionToken:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+300000)}});
 const [count,aggregate]=await Promise.all([db.housePointLedger.count(),db.housePointLedger.aggregate({_sum:{points:true}})]);
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const context=await browser.newContext();await context.addCookies([{name:'gen_mumins_session',value:session.sessionToken,url:base}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin/rewards/history',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('heading',{name:'Complete Qabila history',exact:true}).waitFor();
 await page.getByRole('heading',{name:`Filtered total: ${(aggregate._sum.points||0).toLocaleString()} net points`,exact:true}).waitFor();
 assert.equal(await page.locator('article').count(),Math.min(30,count));
 const first=count?await page.locator('article').first().textContent():'';
 if(count>30){await page.getByRole('link',{name:'Next',exact:true}).click();await page.waitForURL(/page=2/,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForLoadState('domcontentloaded');assert.notEqual(await page.locator('article').first().textContent(),first);await page.getByRole('link',{name:'Last',exact:true}).click();await page.waitForURL(new RegExp('page='+Math.ceil(count/30)),{waitUntil:'domcontentloaded',timeout:60000});}
 await page.getByRole('link',{name:'Badges & recognition',exact:true}).click();await page.waitForURL(/tab=recognition/,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForLoadState('domcontentloaded');assert.equal(await page.locator('article').count(),Math.min(30,await db.recognitionAward.count()));
 await page.getByRole('link',{name:'Team reward unlocks',exact:true}).click();await page.waitForURL(/tab=rewards/,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForLoadState('domcontentloaded');assert.equal(await page.locator('article').count(),Math.min(30,await db.houseUnlock.count()));
 assert.equal(errors.length,0,errors.join('\n'));
 const anon=await fetch(base+'/admin/rewards/history');assert.ok(!(await anon.text()).includes('Filtered total:'));
 console.log(JSON.stringify({historyPassed:true,completeLedgerCount:count,totalMatchesDatabase:true,paginationPassed:true,recognitionAndRewardsPassed:true,anonymousBlocked:true,browserErrors:0}));
}finally{if(browser)await browser.close();if(session)await db.session.deleteMany({where:{id:session.id}});await db.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1});
