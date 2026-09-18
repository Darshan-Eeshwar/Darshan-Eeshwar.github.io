(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./dashboard-core.js'):root.DashboardCore;
function previousRange(f){
 if(!C.validDate(f.from)||!C.validDate(f.to)||f.from>f.to)return null;
 const days=Math.round((Date.parse(f.to)-Date.parse(f.from))/86400000)+1;
 const to=new Date(Date.parse(f.from)-86400000).toISOString().slice(0,10);
 const from=new Date(Date.parse(f.from)-days*86400000).toISOString().slice(0,10);
 return C.validDate(from)&&C.validDate(to)?{...f,from,to}:null;
}
function metrics(data,view,f){
 const rows=k=>C.filter(data[k],f),sum=C.sum,ratio=C.ratio;
 const item=(label,value,unit='number')=>({label,value,unit});
 if(view==='executive'||view==='finance'){
  const r=rows('finance'),revenue=sum(r,'revenue'),cost=sum(r,'cost');
  return {count:r.length,items:[item('Revenue',r.length?revenue:null,'money'),item('Operating profit',r.length?revenue-cost:null,'money'),item('Profit margin',r.length?ratio(revenue-cost,revenue):null,'rate'),item('Net cash flow',r.length?sum(r,'cashIn')-sum(r,'cashOut'):null,'money')]};
 }
 if(view==='sales'){
  const r=rows('sales'),won=r.filter(x=>x.stage==='Won');
  return {count:r.length,items:[item('Won revenue',r.length?sum(won,'revenue'):null,'money'),item('Won opportunities',r.length?won.length:null),item('Lead-to-win conversion',ratio(won.length,r.length),'rate'),item('New customers',r.length?sum(won,'customers'):null)]};
 }
 if(view==='marketing'){
  const r=rows('marketing'),spend=sum(r,'spend');
  return {count:r.length,items:[item('Campaign spend',r.length?spend:null,'money'),item('Campaign ROI',ratio(sum(r,'attributedRevenue')-spend,spend),'rate'),item('Acquisition cost',ratio(spend,sum(r,'customers')),'money'),item('Click-through rate',ratio(sum(r,'clicks'),sum(r,'impressions')),'rate')]};
 }
 const r=rows('operations'),done=r.filter(x=>x.status==='Delivered');
 return {count:r.length,items:[item('Orders',r.length?r.length:null),item('Order fulfillment',ratio(done.length,r.length),'rate'),item('On-time delivery',ratio(done.filter(x=>x.deliveredDate<=x.dueDate).length,done.length),'rate'),item('Average lead time',ratio(sum(r,'leadDays'),r.length),'days')]};
}
function compare(data,view,f){const prior=previousRange(f);if(!prior)return null;const current=metrics(data,view,f),previous=metrics(data,view,prior);return {prior,currentCount:current.count,previousCount:previous.count,items:current.items.map((m,i)=>({...m,previous:previous.items[i].value,difference:m.value===null||previous.items[i].value===null?null:m.value-previous.items[i].value}))};}
function sortRows(rows,field,direction='asc'){return rows.map((row,index)=>({row,index})).sort((a,b)=>{const x=a.row[field],y=b.row[field];const delta=typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''),'en',{numeric:true});return (direction==='desc'?-delta:delta)||a.index-b.index;}).map(x=>x.row);}
function prepareImport(data,sample,{filename,text,dataset,mode='replace'}){
 if(!['replace','append'].includes(mode))throw Error('Choose replace or append.');
 let next,nextSample=false,changes=[];
 if(filename.toLowerCase().endsWith('.json')){
  if(mode==='append')throw Error('JSON backups replace the full workspace. Select Replace before importing a backup.');
  const input=JSON.parse(text);next=C.workspace(input);nextSample=input.sample===true;
  changes=Object.keys(C.schemas).map(k=>({dataset:k,before:data[k].length,incoming:next[k].length,after:next[k].length}));
 }else if(filename.toLowerCase().endsWith('.csv')){
  if(!Object.hasOwn(C.schemas,dataset))throw Error('Choose a dataset.');
  const incoming=C.validate(dataset,C.parseCSV(text,C.fields(dataset)));
  next=sample?Object.fromEntries(Object.keys(C.schemas).map(k=>[k,[]])):{...data};
  next[dataset]=C.validate(dataset,mode==='append'?[...next[dataset],...incoming]:incoming);
  changes=Object.keys(C.schemas).filter(k=>sample||k===dataset).map(k=>({dataset:k,before:data[k].length,incoming:k===dataset?incoming.length:0,after:next[k].length}));
 }else throw Error('Choose a .csv or .json file.');
 return {data:next,sample:nextSample,changes,removedSample:sample&&!nextSample,mode,filename};
}
function updateRecord(data,dataset,record,originalId=null){
 if(!Object.hasOwn(C.schemas,dataset))throw Error('Unknown dataset.');
 const index=originalId===null?-1:data[dataset].findIndex(r=>r.id===originalId);
 if(originalId!==null&&index<0)throw Error('Record no longer exists.');
 if(originalId!==null&&record.id!==originalId)throw Error('An existing record ID cannot be changed.');
 const next=[...data[dataset]];if(index<0)next.push(record);else next[index]=record;
 return {...data,[dataset]:C.validate(dataset,next)};
}
function deleteRecord(data,dataset,id){
 if(!Object.hasOwn(C.schemas,dataset))throw Error('Unknown dataset.');
 if(!data[dataset].some(r=>r.id===id))throw Error('Record no longer exists.');
 return {...data,[dataset]:data[dataset].filter(r=>r.id!==id)};
}
const defaultRules=Object.freeze({margin:20,roi:0,conversion:30,budget:100,lateDays:1});
function validateRules(input){const out={};for(const k of Object.keys(defaultRules)){if(input[k]===''||input[k]===null||!['number','string'].includes(typeof input[k]))throw Error('Enter every alert threshold.');const n=Number(input[k]);const min=k==='roi'?-100:0,max=['margin','conversion'].includes(k)?100:k==='lateDays'?365:10000;if(!Number.isFinite(n)||n<min||n>max||k==='lateDays'&&!Number.isInteger(n))throw Error(`Invalid ${k} threshold.`);out[k]=n;}return out;}
function alerts(data,view,f,rules=defaultRules){
 rules=validateRules(rules);const out=[],rows=k=>C.filter(data[k],f),sum=C.sum;
 const add=(dataset,label,detail,id='')=>out.push({dataset,label,detail,id});
 if(view==='executive'||view==='finance'){const r=rows('finance');if(r.length){const revenue=sum(r,'revenue'),cost=sum(r,'cost'),budget=sum(r,'budget'),margin=C.ratio(revenue-cost,revenue),usage=C.ratio(cost,budget);if(margin!==null&&margin*100<rules.margin)add('finance','Profit margin below threshold',`${(margin*100).toFixed(1)}% vs ${rules.margin}% minimum`);if(usage!==null&&usage*100>=rules.budget)add('finance','Expense budget threshold reached',`${(usage*100).toFixed(1)}% vs ${rules.budget}% threshold`);if(sum(r,'cashIn')<sum(r,'cashOut'))add('finance','Negative net cash flow','Cash paid exceeds cash received in this selection.');}}
 if(view==='executive'||view==='sales'){const r=rows('sales'),rate=C.ratio(r.filter(x=>x.stage==='Won').length,r.length);if(rate!==null&&rate*100<rules.conversion)add('sales','Win rate below threshold',`${(rate*100).toFixed(1)}% vs ${rules.conversion}% minimum`);}
 if(view==='executive'||view==='marketing'){const r=rows('marketing'),spend=sum(r,'spend'),roi=C.ratio(sum(r,'attributedRevenue')-spend,spend);if(roi!==null&&roi*100<rules.roi)add('marketing','Campaign ROI below threshold',`${(roi*100).toFixed(1)}% vs ${rules.roi}% minimum`);}
 if(view==='executive'||view==='operations'){
  const r=rows('operations'),asOf=f.to||new Date().toISOString().slice(0,10);
  for(const stock of C.inventory(r))if(stock.inventory<=stock.reorderPoint)add('operations','Stock at or below reorder point',`${stock.product} / ${stock.supplier} / ${stock.region}: ${stock.inventory} units; reorder at ${stock.reorderPoint}`,stock.id);
  for(const row of r){const end=row.status==='Delivered'?row.deliveredDate:asOf,days=Math.floor((Date.parse(end)-Date.parse(row.dueDate))/86400000);if(days>0&&days>=rules.lateDays)add('operations',row.status==='Delivered'?'Order delivered late':'Open order overdue',`${row.supplier}: ${days} days after ${row.dueDate}`,row.id);}
 }
 return out;
}
function summaryReport(data,view,f,sample,rules=defaultRules,generatedAt=new Date().toISOString()){
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const format=(v,unit)=>v===null?'Unavailable':unit==='money'?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(v):unit==='rate'?(v*100).toFixed(2)+'%':String(Math.round(v*100)/100)+(unit==='days'?' days':'');
 const table=(headers,rows)=>'<table><thead><tr>'+headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 const current=metrics(data,view,f),comparison=compare(data,view,f),notices=alerts(data,view,f,rules);
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;"><title>Business summary report</title><style>body{font:15px/1.6 system-ui,sans-serif;max-width:1050px;margin:40px auto;padding:0 20px;color:#17263b}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #d7dfeb;padding:10px;text-align:left;overflow-wrap:anywhere}th{background:#f1f5fc}h1,h2{line-height:1.3}small{color:#53647b}@media print{body{margin:0}tr{break-inside:avoid}}</style></head><body><h1>'+escape(view)+' dashboard summary</h1><p><strong>'+ (sample?'SAMPLE DATA — illustrative, not live results':'USER WORKSPACE — imported or manually entered data')+'</strong></p><p>Generated: '+escape(generatedAt)+'</p><p>Period: '+escape(f.from||'First record')+' to '+escape(f.to||'Last record')+' · Region: '+escape(f.region||'All')+' · Team: '+escape(f.team||'All')+'</p><p>Metrics use the full date/region/team selection. Record search and sorting do not change this report.</p><h2>Key metrics</h2>'+table(['Metric','Value'],current.items.map(m=>[m.label,format(m.value,m.unit)]))+(comparison?'<h2>Previous period</h2><p>'+escape(comparison.prior.from)+' to '+escape(comparison.prior.to)+' · '+comparison.currentCount+' current / '+comparison.previousCount+' previous source records</p>'+table(['Metric','Current','Previous','Change'],comparison.items.map(m=>[m.label,format(m.value,m.unit),format(m.previous,m.unit),m.difference===null?'Unavailable':m.unit==='rate'?(m.difference*100).toFixed(2)+' percentage points':format(m.difference,m.unit)])):'')+'<h2>Business alerts ('+notices.length+')</h2>'+table(['Dataset','Record','Alert','Detail'],notices.map(a=>[a.dataset,a.id||'Aggregate',a.label,a.detail]))+'<h2>Alert thresholds</h2>'+table(['Rule','Threshold'],Object.entries(validateRules(rules)))+'<h2>Selected dataset coverage</h2>'+table(['Dataset','Records'],Object.keys(C.schemas).map(k=>[k,C.filter(data[k],f).length]))+'<small>All monetary values are INR. Source completeness is not independently verified. Missing periods are unavailable, not zero. Previous periods have equal calendar-day length. Rates use total numerators and denominators. Alert rules identify records for review and do not send notifications. Inventory uses the latest selected snapshot per region/supplier/product. See the dashboard data contract for full definitions.</small></body></html>';
}
const api={previousRange,metrics,compare,sortRows,prepareImport,updateRecord,deleteRecord,defaultRules,validateRules,alerts,summaryReport};if(typeof module!=='undefined')module.exports=api;root.DashboardReporting=api;
})(typeof window!=='undefined'?window:globalThis);
