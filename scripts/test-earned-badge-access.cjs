/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader used to isolate server dependencies in these tests. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
function setup(role="ADMIN", id="admin") {
  const state = { session: {user:{role,id}}, writes: [], active: true, award: {
    id:"award",studentId:"child",certificateCode:"secret-code",isPublic:true,revokedAt:null,recipientName:null,
    title:"The Reliable One",badgeKey:"RELIABLE",evidence:"Joined four classes",description:"Reliability",awardedAt:new Date("2026-10-13T10:00:00Z"),
    student:{userId:"student",displayName:"Rania Osman",user:{firstName:"Rania",lastName:"Osman"},parents:[{parent:{userId:"parent"}}],houseMembership:{qabilaGroup:"Qabila Banu Zuhra"},registrationStudents:[{gender:"Girl"}]},
  }};
  const filename=path.resolve("src/app/badges/[code]/page.tsx"); const mod=new Module(filename);mod.paths=module.paths;
  mod.require=id=>{
    if(id==="next/navigation")return{notFound:()=>{throw Error("404")},redirect:url=>{throw Error("redirect:"+url)}};
    if(id==="next/cache")return{revalidatePath:()=>{}};
    if(id==="@/lib/auth/session")return{getCurrentSession:async()=>state.session};
    if(id==="@/lib/db")return{db:{recognitionAward:{findUnique:async()=>state.award,updateMany:async args=>{if(!state.active)return{count:0};state.writes.push(args);return{count:1}}}}};
    if(id==="next/link")return()=>null;
    if(id.startsWith("@/components/"))return new Proxy({},{get:()=>()=>null});
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
  return {state,page:()=>mod.exports.default({params:Promise.resolve({code:"secret-code"}),searchParams:Promise.resolve({})})};
}
function form(node){if(!node)return null;if(Array.isArray(node))return node.map(form).find(Boolean);if(node.type==="form")return node;return form(node.props?.children);}
test("badge page permits its student and linked parent, rejects unrelated viewers",async()=>{for(const [role,id]of [["STUDENT","student"],["PARENT","parent"]]){const f=setup(role,id);assert.ok(await f.page());assert.equal(form(await f.page()),undefined);}for(const [role,id]of [["STUDENT","other"],["PARENT","other"]])await assert.rejects(setup(role,id).page(),/404/);});
test("revoked, hidden and missing awards cannot be downloaded",async()=>{for(const key of ["revokedAt","isPublic","missing"]){const f=setup();if(key==="missing")f.state.award=null;else f.state.award[key]=key==="revokedAt"?new Date():false;await assert.rejects(f.page(),/404/);}});
test("only admin may save a name, and the update is scoped to an active award",async()=>{const f=setup();const action=form(await f.page()).props.action;const data=new FormData();data.set("recipientName","  Rania   Osman  ");await assert.rejects(action(data),/redirect:.*saved=1/);assert.deepEqual(f.state.writes,[{where:{certificateCode:"secret-code",isPublic:true,revokedAt:null},data:{recipientName:"Rania Osman"}}]);f.state.session.user.role="PARENT";await assert.rejects(action(data),/404/);assert.equal(f.state.writes.length,1);});
test("blank names reset to profile, long names and revoked updates are rejected",async()=>{const f=setup();const action=form(await f.page()).props.action;const data=new FormData();data.set("recipientName"," ");await assert.rejects(action(data),/saved=1/);assert.equal(f.state.writes[0].data.recipientName,null);data.set("recipientName","a".repeat(81));await assert.rejects(action(data),/error=name/);assert.equal(f.state.writes.length,1);data.set("recipientName","Rania");f.state.active=false;await assert.rejects(action(data),/404/);});
