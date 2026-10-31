import assert from 'node:assert/strict';
import {makeHandler} from './backend.mjs';
const tables={df_accounts:[],df_sessions:[],df_journals:[],df_device_activity:[]};const counts=new Map();
const fake=async(input,opts)=>{
 const u=new URL(input),path=u.pathname.split('/rest/v1/')[1],data=opts.body?JSON.parse(opts.body):null,table=tables[path];let rows;
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
 if(path==='rpc/df_rate_limit'){const n=(counts.get(data.p_key)||0)+1;counts.set(data.p_key,n);return response(n<=data.p_limit)}
 const match=row=>[...u.searchParams].filter(([k])=>!['select','on_conflict'].includes(k)).every(([k,v])=>v.startsWith('eq.')?String(row[k])===v.slice(3):v.startsWith('gt.')?row[k]>Number(v.slice(3)):true);
 const name=path.split('?')[0];const list=tables[name];if(!list)return response({error:'unknown'},400);
 if(opts.method==='GET')return response(list.filter(match).map(x=>({...x})));
 if(opts.method==='POST'){
  if(name==='df_device_activity'){const previous=list.find(x=>x.account_id===data.account_id&&x.device_id===data.device_id&&x.day===data.day&&x.source===data.source);if(previous){Object.assign(previous,structuredClone(data));return response([previous])}}
  if((name==='df_accounts'&&list.some(x=>x.username===data.username))||(name==='df_journals'&&list.some(x=>x.account_id===data.account_id))){return opts.headers.Prefer?.includes('ignore-duplicates')?response([]):response({code:'23505'},409)}
  list.push(structuredClone(data));return response([data]);
 }
 if(opts.method==='PATCH'){rows=list.filter(match);for(const row of rows)Object.assign(row,structuredClone(data));return response(rows)}
 if(opts.method==='DELETE'){rows=list.filter(match);tables[name]=list.filter(x=>!match(x));return response(rows)}
 return response(null,400);
};
const handle=makeHandler({url:'https://example.supabase.co',key:'test-server-only'},fake);
const req=async(path,{method='GET',data,token,origin='https://darshan-eeshwar.github.io'}={})=>{
 const headers={origin};if(data)headers['Content-Type']='application/json';if(token)headers['x-fitness-session']=token;
 const r=await handle(new Request('https://example.supabase.co/functions/v1/darshan-fitness-api'+path,{method,headers,body:data?JSON.stringify(data):undefined}));return {status:r.status,body:await r.json().catch(()=>null),headers:r.headers};
};
assert.equal((await req('/health')).status,200);assert.equal((await req('/health',{origin:'https://evil.test'})).status,403);
assert.equal((await req('/api/journal')).status,401);
const a=await req('/api/auth/register',{method:'POST',data:{username:'test_a',password:'test-only-password-123'}});assert.equal(a.status,200);assert.equal(a.body.token.length,64);
const t=a.body.token;
const phone={deviceId:'12345678-1234-1234-1234-123456789012',source:'phone_sensor',date:new Date().toISOString().slice(0,10),steps:500,hours:Array(24).fill(0),updatedAt:Date.now()};phone.hours[10]=500;
assert.equal((await req('/api/device/sync',{method:'POST',data:phone})).status,401);
assert.equal((await req('/api/device/sync',{method:'POST',token:t,data:phone})).status,200);
assert.equal((await req('/api/device/data',{token:t})).body.records[0].steps,500);
assert.equal((await req('/api/device/sync',{method:'POST',token:t,data:{...phone,steps:600,updatedAt:Date.now()}})).status,200);
assert.equal((await req('/api/device/data',{token:t})).body.records.length,1);
assert.equal((await req('/api/device/data',{token:t})).body.records[0].steps,600);
assert.equal((await req('/api/device/sync',{method:'POST',token:t,data:{...phone,hours:[1]}})).status,400);
assert.equal((await req('/api/device/sync',{method:'POST',token:t,data:{...phone,date:'2026-02-31'}})).status,400);
const hc={...phone,source:'health_connect',steps:750,activeMinutes:30,activeCalories:120,totalCalories:1200,distanceKm:.5};
assert.equal((await req('/api/device/sync',{method:'POST',token:t,data:hc})).status,200);
assert.equal((await req('/api/device/data',{token:t})).body.records.length,2);
const j={version:1,goals:{steps:8000,water:2500,start:85,target:78,stride:.72},days:{'2026-10-31':{entries:[{id:'water',at:Date.now(),type:'water',value:250,label:'Water'}]}}};
assert.equal((await req('/api/journal',{method:'PUT',token:t,data:{version:0,data:j}})).status,200);
assert.deepEqual((await req('/api/journal',{token:t})).body.data,j);
const expanded=structuredClone(j);expanded.goals={...expanded.goals,protein:110,sleep:8,weeklyWorkouts:4};expanded.routines=[{id:'routine-test',name:'Test routine',exercises:[{name:'Bench press',sets:3,reps:10,load:40}]}];expanded.days['2026-10-31'].entries.push(
{id:'strength-1',at:Date.now(),type:'strength',value:3,label:'Bench press',reps:10,load:40},
{id:'protein-1',at:Date.now(),type:'protein',value:25,label:'Protein'},
{id:'mood-1',at:Date.now(),type:'mood',value:4,label:'Mood'},
{id:'energy-1',at:Date.now(),type:'energy',value:3,label:'Energy'},
{id:'waist-1',at:Date.now(),type:'measurement',value:90,label:'Waist'},
{id:'note-1',at:Date.now(),type:'note',value:0,label:'Daily reflection',note:'Felt good after training.'});
assert.equal((await req('/api/journal',{method:'PUT',token:t,data:{version:1,data:expanded}})).status,200);
assert.deepEqual((await req('/api/journal',{token:t})).body.data,expanded);
for(const change of [x=>x.days['2026-10-31'].entries[1].reps=0,x=>x.days['2026-10-31'].entries[1].load=-1,x=>x.days['2026-10-31'].entries[3].value=3.5,x=>x.days['2026-10-31'].entries[6].note='x'.repeat(801),x=>x.goals.weeklyWorkouts=8,x=>x.routines[0].exercises[0].load=501,x=>x.routines.push({...x.routines[0]}),x=>x.routines=[null]]){const invalid=structuredClone(expanded);change(invalid);assert.equal((await req('/api/journal',{method:'PUT',token:t,data:{version:2,data:invalid}})).status,400)}

assert.equal((await req('/api/journal',{method:'PUT',token:t,data:{version:0,data:j}})).status,409);
const b=await req('/api/auth/register',{method:'POST',data:{username:'test_b',password:'test-only-password-456'}});assert.equal(b.status,200);assert.equal((await req('/api/journal',{token:b.body.token})).body.data,null);assert.equal((await req('/api/device/data',{token:b.body.token})).body.records.length,0);
assert.equal((await req('/api/auth/login',{method:'POST',data:{username:'test_a',password:'incorrect-password-123'}})).status,401);
const l=await req('/api/auth/login',{method:'POST',data:{username:'test_a',password:'test-only-password-123'}});assert.equal(l.status,200);assert.equal((await req('/api/journal',{token:l.body.token})).body.version,2);
assert.equal((await req('/api/journal',{method:'PUT',token:t,data:{version:1,data:{...j,goals:{...j.goals,steps:-1}}}})).status,400);
const change=await req('/api/auth/password',{method:'POST',token:t,data:{current:'test-only-password-123',next:'new-test-password-123'}});assert.equal(change.status,200);assert.equal((await req('/api/journal',{token:t})).status,401);assert.equal((await req('/api/journal',{token:change.body.token})).status,200);
await req('/api/auth/logout',{method:'POST',token:change.body.token,data:{}});assert.equal((await req('/api/journal',{token:change.body.token})).status,401);
assert.notEqual(tables.df_accounts[0].password_hash,'new-test-password-123');assert.equal(tables.df_accounts[0].password_hash.length,64);
for(let n=0;n<11;n++)await req('/api/auth/login',{method:'POST',data:{username:'test_missing',password:'incorrect-test-password'}});
assert.equal((await req('/api/auth/login',{method:'POST',data:{username:'test_missing',password:'incorrect-test-password'}})).status,429);
console.log('PASS: Device sync/upsert/account isolation/invalid data, routine and journal round-trip, invalid routine rejection, invalid feature rejection, backward compatibility, CORS restriction, username/password registration/login, hashed credentials, session isolation/revocation, per-user persistence, input validation, concurrency conflict, password change and rate limiting. Mock REST only; live smoke test still required.');
