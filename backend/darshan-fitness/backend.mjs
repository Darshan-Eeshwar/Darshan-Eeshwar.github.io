const enc=new TextEncoder();const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function hash(password,salt){const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},k,256))}
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
class Failure extends Error{constructor(status,message){super(message);this.status=status}}
function fail(status,message){throw new Failure(status,message)}
export function validJournal(s){const bounds={steps:[100,100000],water:[250,10000],start:[20,400],target:[20,400],stride:[.2,1.5]},types={water:[0,10000],steps:[0,100000],sleep:[0,24],weight:[20,400],meal:[0,10000],workout:[0,600]};return s?.version===1&&s.goals&&Object.entries(bounds).every(([k,[a,b]])=>Number.isFinite(s.goals[k])&&s.goals[k]>=a&&s.goals[k]<=b)&&s.days&&typeof s.days==='object'&&!Array.isArray(s.days)&&Object.keys(s.days).length<=5000&&Object.entries(s.days).every(([date,d])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&Array.isArray(d?.entries)&&d.entries.length<=500&&(d.sensorSteps===undefined||(Number.isInteger(d.sensorSteps)&&d.sensorSteps>=0&&d.sensorSteps<=200000))&&d.entries.every(e=>types[e.type]&&Number.isFinite(e.value)&&e.value>=types[e.type][0]&&e.value<=types[e.type][1]&&typeof e.id==='string'&&e.id.length<=100&&Number.isFinite(e.at)&&e.at>0&&(!e.label||(typeof e.label==='string'&&e.label.length<=80))));}
export function makeHandler(env,fetcher=fetch){
 const origin='https://darshan-eeshwar.github.io';
 const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'content-type,x-fitness-session','Access-Control-Max-Age':'600','Vary':'Origin'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 async function db(path,method='GET',body,prefer='return=representation'){
  const r=await fetcher(env.url+'/rest/v1/'+path,{method,headers:{apikey:env.key,Authorization:'Bearer '+env.key,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});let b;try{b=await r.json()}catch{b=null}if(!r.ok){if(b?.code==='23505')fail(409,'That username is unavailable. Please choose another.');fail(503,'Cloud storage is unavailable. Please retry.')}return b;
 }
 async function rate(key,limit=10){if(!await db('rpc/df_rate_limit','POST',{p_key:await sha(key),p_limit:limit,p_window_ms:900000}))fail(429,'Too many attempts. Try again in 15 minutes.')}
 async function body(req){if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'Send JSON data.');if(Number(req.headers.get('content-length')||0)>1500000)fail(413,'Journal is too large.');const raw=await req.text();if(raw.length>1500000)fail(413,'Journal is too large. Export a backup and reduce older entries.');try{return JSON.parse(raw)}catch{fail(400,'Invalid JSON.')}}
 async function session(req){const token=req.headers.get('x-fitness-session')||'';if(!/^[a-f0-9]{64}$/.test(token))fail(401,'Please sign in.');const rows=await db('df_sessions?token_hash=eq.'+await sha(token)+'&expires_at=gt.'+Date.now()+'&select=account_id,auth_version');if(!rows?.length)fail(401,'Your session expired. Please sign in again.');const a=(await db('df_accounts?id=eq.'+rows[0].account_id+'&select=id,username,auth_version'))[0];if(!a||a.auth_version!==rows[0].auth_version)fail(401,'Please sign in again.');return a}
 async function newSession(id,version){const token=random();await db('df_sessions','POST',{token_hash:await sha(token),account_id:id,auth_version:version,expires_at:Date.now()+7*86400000});return token}
 return async function handle(req){try{
  if(req.headers.get('origin')!==origin)return new Response('Origin not allowed',{status:403});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  const url=new URL(req.url),path=url.pathname.split('/darshan-fitness-api')[1]||'/',method=req.method;
  if(!env.url||!env.key)fail(503,'Backend configuration is unavailable.');
  if(path==='/health'&&method==='GET')return reply({ok:true,name:'Darshan Eeshwar Fitness'});
  if(path==='/api/auth/status'&&method==='GET'){try{const a=await session(req);return reply({authenticated:true,username:a.username})}catch(e){if(e.status!==401)throw e;return reply({authenticated:false,hasAccount:true})}}
  if((path==='/api/auth/register'||path==='/api/auth/login')&&method==='POST'){
   const b=await body(req),username=String(b.username||'').trim().toLowerCase(),password=b.password;
   if(!/^[a-z0-9_]{3,30}$/.test(username)||typeof password!=='string'||password.length<12||password.length>128)fail(400,'Use a username of 3–30 letters, numbers or underscores and a password of 12–128 characters.');
   const ip=req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';await rate('ip:'+ip,30);await rate('user:'+username,10);
   let a;
   if(path.endsWith('register')){const salt=random();a={id:crypto.randomUUID(),username,auth_version:1};await db('df_accounts','POST',{...a,password_hash:await hash(password,salt),salt,created_at:Date.now()})}
   else{a=(await db('df_accounts?username=eq.'+username+'&select=id,username,password_hash,salt,auth_version'))?.[0];const actual=await hash(password,a?.salt||'0'.repeat(64));if(!a||!equal(actual,a.password_hash))fail(401,'Incorrect username or password.');}
   return reply({authenticated:true,username:a.username,token:await newSession(a.id,a.auth_version)});
  }
  if(path==='/api/auth/logout'&&method==='POST'){const token=req.headers.get('x-fitness-session')||'';if(/^[a-f0-9]{64}$/.test(token))await db('df_sessions?token_hash=eq.'+await sha(token),'DELETE');return reply({ok:true})}
  const a=await session(req);
  if(path==='/api/journal'&&method==='GET'){const row=(await db('df_journals?account_id=eq.'+a.id+'&select=data,version,updated_at'))[0];return reply(row?{data:row.data,version:row.version,updatedAt:row.updated_at}:{data:null,version:0,updatedAt:null})}
  if(path==='/api/journal'&&method==='PUT'){
   const b=await body(req);if(!validJournal(b.data)||!Number.isInteger(b.version)||b.version<0)fail(400,'Invalid entries or goals.');const now=Date.now();let rows;
   if(b.version===0){rows=await db('df_journals?on_conflict=account_id','POST',{account_id:a.id,data:b.data,version:1,updated_at:now},'resolution=ignore-duplicates,return=representation')}
   else{rows=await db('df_journals?account_id=eq.'+a.id+'&version=eq.'+b.version,'PATCH',{data:b.data,version:b.version+1,updated_at:now})}
   if(!rows?.length)fail(409,'Another device saved newer records. Export pending changes, then reload cloud records.');return reply({version:b.version+1,updatedAt:now})
  }
  if(path==='/api/auth/password'&&method==='POST'){
   await rate('password:'+a.id,10);const b=await body(req);if(typeof b.current!=='string'||typeof b.next!=='string'||b.next.length<12||b.next.length>128)fail(400,'Use a new password of 12–128 characters.');const row=(await db('df_accounts?id=eq.'+a.id+'&select=password_hash,salt'))[0];if(!equal(await hash(b.current,row.salt),row.password_hash))fail(401,'Current password is incorrect.');const salt=random();const changed=await db('df_accounts?id=eq.'+a.id+'&auth_version=eq.'+a.auth_version,'PATCH',{password_hash:await hash(b.next,salt),salt,auth_version:a.auth_version+1});if(!changed?.length)fail(409,'Password changed on another device. Sign in again.');a.auth_version++;await db('df_sessions?account_id=eq.'+a.id,'DELETE');return reply({ok:true,token:await newSession(a.id,a.auth_version)})
  }
  return reply({error:'Endpoint not found.'},404);
 }catch(e){return reply({error:e instanceof Failure?e.message:'Request failed. Your pending records remain in this page.'},e.status||500)}};
}
