const assert=require('node:assert/strict');const {PrismaClient}=require('@prisma/client');const {randomBytes}=require('node:crypto');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const db=new PrismaClient();const sessions=[];let browser;
(async()=>{try{
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 for(const role of ['parent','student'].filter(role=>!process.env.NAV_TEST_ROLE||process.env.NAV_TEST_ROLE===role)){
 const user=await db.user.findFirst({where:role==='parent'?{role:'PARENT',status:'ACTIVE',firstName:{contains:'Areej'}}:{role:'STUDENT',status:'ACTIVE',studentProfile:{isNot:null}},select:{id:true}});assert.ok(user);
 const session=await db.session.create({data:{userId:user.id,sessionToken:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+300000)}});sessions.push(session.id);
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addCookies([{name:'gen_mumins_session',value:session.sessionToken,url:'http://localhost:3097'}]);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3097/'+role,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('h1').first().waitFor();const original=await page.locator('h1').first().textContent();
 let delayed=0;
 await page.route(`**/${role}/fardh-tracker*`,async route=>{if(route.request().headers().rsc==='1'){delayed++;await new Promise(r=>setTimeout(r,role==='parent'?4000:14000));}await route.continue();});
 await page.getByRole('navigation',{name:'Quick access'}).getByRole('link',{name:'Fardh',exact:true}).click();
 await page.getByText('Loading section...', {exact:true}).waitFor({timeout:10000});
 assert.equal(await page.locator('h1').first().textContent(),original,'Current page must remain visible during navigation');
 assert.equal(await page.getByText('Opening your page...', {exact:true}).count(),0);
 assert.ok(await page.getByRole('navigation',{name:'Quick access'}).isVisible());
 if(role==='student'){await page.getByText('Still connecting.',{exact:false}).waitFor({timeout:15000});assert.equal(await page.locator('h1').first().textContent(),original);}
 await page.getByRole('heading',{name:role==='parent'?'Fardh Prayer Tracker':'My Fardh Prayer Tracker',exact:true}).waitFor({timeout:60000});
 assert.equal(await page.getByText('Loading section...', {exact:true}).count(),0);assert.equal(await page.getByText('Still connecting.',{exact:false}).count(),0);
 assert.ok(delayed>0);assert.equal(errors.length,0,errors.join('\n'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(JSON.stringify({role,retainedPage:true,usableNavigation:true,fullScreenLoader:false,indicatorCleared:true,browserErrors:0}));await context.close();
 }
}finally{if(browser)await browser.close();await db.session.deleteMany({where:{id:{in:sessions}}});await db.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
