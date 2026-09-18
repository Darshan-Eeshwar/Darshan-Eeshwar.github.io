(function(root){
'use strict';
const schemas={
 sales:{text:['id','date','region','team','product','stage'],numbers:['revenue','cost','customers'],enums:{stage:['Lead','Qualified','Proposal','Won','Lost']}},
 marketing:{text:['id','date','region','team','channel'],numbers:['spend','impressions','clicks','visits','leads','customers','attributedRevenue','engagements']},
 finance:{text:['id','date','region','team','category'],numbers:['revenue','cost','cashIn','cashOut','budget','forecast']},
 operations:{text:['id','date','region','team','supplier','product','status','dueDate','deliveredDate'],numbers:['quantity','inventory','reorderPoint','leadDays'],enums:{status:['Pending','Processing','Delivered','Delayed']}},
 targets:{text:['id','date','region','team','metric'],numbers:['target'],enums:{metric:['revenue','customers','fulfilledOrders']}}
};
const fields=k=>[...schemas[k].text,...schemas[k].numbers];
function parseCSV(text,requiredHeaders=[]){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;}
 else if(c==='"'){if(value||closed)throw Error('Invalid CSV quote.');quoted=true;}
 else if(c===','||c==='\n'||c==='\r'){row.push(value);value='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}}
 else{if(closed)throw Error('Unexpected text after quoted CSV field.');value+=c;}}
 if(quoted)throw Error('Unclosed CSV quote.');row.push(value);if(row.some(v=>v!==''))rows.push(row);
 if(!rows.length)throw Error('CSV is empty.');const headers=rows.shift().map(s=>s.trim());if(new Set(headers).size!==headers.length)throw Error('Duplicate CSV headers.');for(const h of requiredHeaders)if(!headers.includes(h))throw Error('Missing CSV column: '+h);
 return rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`Row ${i+2}: incorrect column count.`);return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
}
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
function validate(k,rows){
 if(!schemas[k]||!Array.isArray(rows))throw Error('Unknown dataset or invalid rows.');if(rows.length>20000)throw Error('Maximum 20,000 rows per dataset.');const seen=new Set();
 return rows.map((r,i)=>{const fail=m=>{throw Error(`${k} row ${i+1}: ${m}`);};if(!r||typeof r!=='object'||Array.isArray(r))fail('expected an object');const clean={};
 for(const f of fields(k)){if(!(f in r))fail(`missing ${f}`);const v=r[f];if(schemas[k].numbers.includes(f)){if(v===null||!['number','string'].includes(typeof v)||typeof v==='string'&&!v.trim()||!Number.isFinite(Number(v))||Number(v)<0)fail(`${f} must be a non-negative number`);clean[f]=Number(v);if(['customers','impressions','clicks','visits','leads','engagements','quantity','inventory','reorderPoint'].includes(f)&&!Number.isInteger(clean[f]))fail(`${f} must be a whole number`);}
 else{if(typeof v!=='string'||v.length>200)fail(`${f} must be text under 201 characters`);clean[f]=v.trim();if(!clean[f]&&f!=='deliveredDate')fail(`${f} is required`);}}
 if(!validDate(clean.date))fail('invalid date (use YYYY-MM-DD)');if(seen.has(clean.id))fail('duplicate id');seen.add(clean.id);
 for(const [f,options] of Object.entries(schemas[k].enums||{}))if(!options.includes(clean[f]))fail(`${f} must be ${options.join(', ')}`);
 if(k==='operations'){if(!validDate(clean.dueDate)||(clean.deliveredDate&&!validDate(clean.deliveredDate)))fail('invalid delivery date');if(clean.status==='Delivered'&&!clean.deliveredDate)fail('delivered orders need deliveredDate');if(clean.status!=='Delivered'&&clean.deliveredDate)fail('only Delivered orders may have deliveredDate');if(clean.dueDate<clean.date||clean.deliveredDate&&clean.deliveredDate<clean.date)fail('delivery cannot precede order date');}
 if(k==='marketing'&&(clean.clicks>clean.impressions||clean.customers>clean.leads))fail('clicks exceed impressions or customers exceed leads');
 if(k==='sales'&&clean.stage!=='Won'&&(clean.revenue||clean.cost||clean.customers))fail('only Won opportunities carry realized revenue, cost and new customers');
 return clean;});
}
function workspace(input){if(!input||input.version!==1||!input.datasets)throw Error('Expected a version 1 workspace backup.');const out={};for(const k of Object.keys(schemas))out[k]=validate(k,input.datasets[k]);return out;}
function csv(rows,headers){const quote=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';return [headers,...rows.map(r=>headers.map(h=>r[h]))].map(r=>r.map(quote).join(',')).join('\r\n');}
const sum=(rows,key)=>rows.reduce((s,r)=>s+r[key],0),ratio=(a,b)=>b?a/b:null;
function filter(rows,f){return rows.filter(r=>(!f.from||r.date>=f.from)&&(!f.to||r.date<=f.to)&&(!f.region||r.region===f.region)&&(!f.team||r.team===f.team));}
function aggregate(rows,key,measure){const groups=new Map();for(const r of rows)groups.set(r[key],(groups.get(r[key])||0)+r[measure]);return [...groups].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);}
function series(rows,keys,group='month',from='',to=''){if(!rows.length)return [];const bucket=d=>group==='quarter'?`${d.slice(0,4)} Q${Math.ceil(Number(d.slice(5,7))/3)}`:d.slice(0,7);const map=new Map();const first=from||rows.map(r=>r.date).sort()[0],last=to||rows.map(r=>r.date).sort().at(-1);let d=new Date(first.slice(0,7)+'-01T00:00:00Z');const end=new Date(last.slice(0,7)+'-01T00:00:00Z');while(d<=end&&map.size<1200){const label=bucket(d.toISOString());map.set(label,{label,...Object.fromEntries(keys.map(k=>[k,0]))});d.setUTCMonth(d.getUTCMonth()+1);}for(const r of rows){const label=bucket(r.date);if(!map.has(label))map.set(label,{label,...Object.fromEntries(keys.map(k=>[k,0]))});for(const k of keys)map.get(label)[k]+=r[k];}return [...map.values()].sort((a,b)=>a.label.localeCompare(b.label));}
function inventory(rows){const latest=new Map();for(const r of rows){const key=JSON.stringify([r.region,r.supplier,r.product]);if(!latest.has(key)||r.date>latest.get(key).date||r.date===latest.get(key).date&&r.id>latest.get(key).id)latest.set(key,r);}return [...latest.values()];}
function demo(){const data=Object.fromEntries(Object.keys(schemas).map(k=>[k,[]]));let id=0;for(let m=1;m<=9;m++)for(let regionIndex=0;regionIndex<3;regionIndex++){const region=['South','West','North'][regionIndex],team=['Growth','Commerce','Services'][regionIndex],date=`2026-${String(m).padStart(2,'0')}-01`,base=70000+m*8200+regionIndex*15000;
 for(let p=0;p<5;p++){const stage=['Won','Won','Proposal','Qualified','Lead'][p],won=stage==='Won';data.sales.push({id:`S${++id}`,date,region,team,product:['Website','Commerce','Maintenance','SEO','Automation'][p],stage,revenue:won?base+p*12000:0,cost:won?Math.round(base*.48):0,customers:won?3+p:0});}
 for(let c=0;c<3;c++)data.marketing.push({id:`M${++id}`,date,region,team,channel:['Search','Social','Email'][c],spend:5000+m*400+c*900,impressions:22000+m*2100+c*4200,clicks:900+m*80+c*90,visits:760+m*60+c*70,leads:48+m*3+c*8,customers:7+m+c,attributedRevenue:24000+m*2200+c*3000,engagements:1200+m*100+c*60});
 data.finance.push({id:`F${++id}`,date,region,team,category:'Business activity',revenue:base*2+12000,cost:Math.round(base*1.1),cashIn:base*1.9,cashOut:base*1.05,budget:base*1.2,forecast:base*2.15});
 for(let p=0;p<3;p++){const status=['Delivered','Processing','Delayed'][(m+p+regionIndex)%3];data.operations.push({id:`O${++id}`,date,region,team,supplier:['Vertex Supply','Coastal Partners','Metro Logistics'][p],product:['Equipment','Packaging','Accessories'][p],status,dueDate:`2026-${String(m).padStart(2,'0')}-15`,deliveredDate:status==='Delivered'?`2026-${String(m).padStart(2,'0')}-${p===2?'18':'12'}`:'',quantity:12+p*4,inventory:Math.max(0,15+m*2-p*9),reorderPoint:18,leadDays:5+p*3});}
 for(const [metric,target]of [['revenue',base*2.2],['customers',10],['fulfilledOrders',3]])data.targets.push({id:`T${++id}`,date,region,team,metric,target});}return data;}
const api={schemas,fields,parseCSV,validate,workspace,csv,validDate,sum,ratio,filter,aggregate,series,inventory,demo};if(typeof module!=='undefined')module.exports=api;root.DashboardCore=api;
})(typeof window!=='undefined'?window:globalThis);
