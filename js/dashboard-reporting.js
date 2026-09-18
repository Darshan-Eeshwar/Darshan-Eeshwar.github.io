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
const api={previousRange,metrics,compare,sortRows,prepareImport};if(typeof module!=='undefined')module.exports=api;root.DashboardReporting=api;
})(typeof window!=='undefined'?window:globalThis);
