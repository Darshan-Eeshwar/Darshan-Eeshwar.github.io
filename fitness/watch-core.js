/* Shared, sensor-independent watch calculations. */
(function(root){
  'use strict';
  const fields={heartRate:['Heart rate','bpm',20,250,1],spo2:['Blood oxygen','%',50,100,1],stress:['Watch stress score','/ 100',0,100,1],temperature:['Skin temperature','°C',20,45,.1],steps:['Watch steps · daily total','steps',0,200000,1],activeMinutes:['Active time · daily total','min',0,1440,1],activeCalories:['Activity energy · daily total','kcal',0,20000,1],distanceKm:['Distance · daily total','km',0,1000,.01],sleepHours:['Last night’s sleep','h',0,24,.01],deepHours:['Deep sleep','h',0,24,.01],lightHours:['Light sleep','h',0,24,.01],remHours:['REM sleep','h',0,24,.01]};
  function validate(reading){
    if(!reading||!['manual_watch','bluetooth_hr'].includes(reading.source)||typeof reading.model!=='string'||reading.model.length>60||!Number.isFinite(reading.recordedAt)||reading.recordedAt<=0)return false;
    let count=0;for(const [key,[,,min,max,step]] of Object.entries(fields)){const n=reading[key];if(n===undefined)continue;if(!Number.isFinite(n)||n<min||n>max||(step===1&&!Number.isInteger(n)))return false;count++;}
    if(reading.source==='bluetooth_hr'&&(count!==1||reading.heartRate===undefined))return false;
    const stages=['deepHours','lightHours','remHours'].filter(k=>reading[k]!==undefined);if(stages.length&&(reading.sleepHours===undefined||stages.reduce((s,k)=>s+reading[k],0)>reading.sleepHours+.02))return false;
    return count>0;
  }
  function latest(entries){const out={};const sorted=entries.filter(e=>e.type==='note'&&validate(e.watchReading)).slice().sort((a,b)=>a.watchReading.recordedAt-b.watchReading.recordedAt||a.at-b.at);for(const e of sorted)for(const k of Object.keys(fields))if(e.watchReading[k]!==undefined)out[k]={value:e.watchReading[k],at:e.watchReading.recordedAt,source:e.watchReading.source,model:e.watchReading.model};return out;}
  function parseHeartRate(view){if(!view||view.byteLength<2)return null;const wide=!!(view.getUint8(0)&1);if(wide&&view.byteLength<3)return null;const n=wide?view.getUint16(1,true):view.getUint8(1);return n>=20&&n<=250?n:null;}
  function distance(a,b){const r=Math.PI/180,x=(b.latitude-a.latitude)*r,y=(b.longitude-a.longitude)*r;const h=Math.sin(x/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin(y/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
  function entry(reading,at=Date.now(),id){if(!validate(reading))throw Error('Check the reading values. Sleep stages cannot exceed total sleep.');return {id:id||at+'-watch-'+Math.random().toString(36).slice(2,8),at,type:'note',value:0,label:reading.source==='manual_watch'?'Watch reading · manual':'Heart rate · Bluetooth',note:(reading.source==='manual_watch'?'Manual watch entry':'Bluetooth heart-rate sensor')+' · '+reading.model+' · '+Object.entries(fields).filter(([k])=>reading[k]!==undefined).map(([k,[label,unit]])=>label+': '+reading[k]+' '+unit).join(' · '),watchReading:reading};}
  const api={fields,validate,latest,parseHeartRate,distance,entry};root.FitnessWatch=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
