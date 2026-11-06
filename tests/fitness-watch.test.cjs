const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const W=require('../fitness/watch-core.js');
const base={source:'manual_watch',model:'Fastrack',recordedAt:1794000000000};
test('watch values and sleep stages reject invalid or incomplete readings',()=>{
 assert.equal(W.validate({...base}),false);
 assert.equal(W.validate({...base,heartRate:72,spo2:98,steps:0}),true);
 for(const values of [{heartRate:Infinity},{heartRate:72.2},{spo2:101},{steps:-1},{sleepHours:6,deepHours:4,remHours:3},{deepHours:2}])assert.equal(W.validate({...base,...values}),false);
 assert.equal(W.validate({...base,sleepHours:8,deepHours:2,lightHours:4,remHours:2}),true);
});
test('latest readings use measurement time, preserve zero and do not sum daily snapshots',()=>{
 const first=W.entry({...base,steps:5000,heartRate:70},100);
 const later=W.entry({...base,recordedAt:base.recordedAt+1000,steps:0},200);
 const older=W.entry({...base,recordedAt:base.recordedAt-1000,steps:9000},300);
 const values=W.latest([later,older,first]);assert.equal(values.steps.value,0);assert.equal(values.heartRate.value,70);
 assert.equal(W.latest([{...first,watchReading:{...base,steps:-1}}]).steps,undefined);
});
test('Bluetooth heart rate decodes both standard formats and rejects truncated payloads',()=>{
 assert.equal(W.parseHeartRate(new DataView(Uint8Array.from([0,72]).buffer)),72);
 assert.equal(W.parseHeartRate(new DataView(Uint8Array.from([1,200,0]).buffer)),200);
 assert.equal(W.parseHeartRate(new DataView(Uint8Array.from([1,72]).buffer)),null);
 assert.equal(W.parseHeartRate(new DataView(Uint8Array.from([0,0]).buffer)),null);
});
test('GPS distance has correct scale and no movement gives zero',()=>{
 assert.equal(W.distance({latitude:0,longitude:0},{latitude:0,longitude:0}),0);
 assert.ok(Math.abs(W.distance({latitude:0,longitude:0},{latitude:0,longitude:1})-111.195)<.01);
});
function activityContext(entries,automatic){
 const source=fs.readFileSync(require.resolve('../fitness/app.js'),'utf8');
 const ctx={FitnessWatch:W,selectedDate:'2026-11-06',state:{goals:{},days:{'2026-11-06':{entries}}},defaults:()=>({goals:{steps:8000,activeMinutes:90,activeCalories:500,stride:.72}}),automaticActivity:()=>automatic};vm.createContext(ctx);
 for(const [start,end]of [['function totals(', 'function render('],['function dailyActivity(', 'function heartSvg(']])vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),ctx);
 return vm.runInContext('dailyActivity(selectedDate)',ctx);
}
test('watch daily steps replace phone steps; manual extra steps still add',()=>{
 const entry=W.entry({...base,steps:6000,activeMinutes:40,activeCalories:200});
 const a=activityContext([entry,{type:'steps',value:100}],{steps:5000,activeMinutes:60,activeCalories:300,hours:[1]});
 assert.equal(a.steps,6100);assert.equal(a.minutes,40);assert.equal(a.activeCalories,200);assert.equal(a.source,'manual_watch');assert.equal(a.hours,undefined);
});
test('existing phone/manual precedence stays intact without watch readings',()=>{
 const a=activityContext([{type:'activeMinutes',value:20},{type:'activeCalories',value:150},{type:'workout',value:45}],{steps:5000,activeMinutes:60,activeCalories:300});
 assert.equal(a.steps,5000);assert.equal(a.minutes,60);assert.equal(a.activeCalories,300);
});
test('watch snapshots round-trip through existing backend journal validation',async()=>{
 const {validJournal}=await import('../backend/darshan-fitness/backend.mjs');
 const data={version:1,goals:{steps:8000,water:2500,start:85,target:78,stride:.72},days:{'2026-11-06':{entries:[W.entry({...base,heartRate:72,steps:6000,sleepHours:8,deepHours:2})]}}};
 assert.equal(validJournal(JSON.parse(JSON.stringify(data))),true);
 const gps={id:'gps-test',at:Date.now(),type:'workout',value:10,label:'Walking · GPS 1.00 km',gpsSummary:{distanceKm:1,durationSeconds:600,source:'phone_gps'}};data.days['2026-11-06'].entries.push(gps);assert.equal(validJournal(data),true);
});
