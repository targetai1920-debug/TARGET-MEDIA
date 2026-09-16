'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const EventEmitter = require('node:events');

const code = fs.readFileSync(path.join(__dirname, '..', 'monitor-apps-script', 'Code.gs'), 'utf8');
const props = {MONITOR_SPREADSHEET_ID:'test-book',MONITOR_SERVER_TOKEN:'script-secret',TIMEZONE:'Europe/Amsterdam'};
const sheets = {
  Businesses: [['Business ID'],['TM-TEST-001','','Test storefront','TM-LOC-TEST-001','','Rotterdam','','Europe/Amsterdam','Monitor',true,'','ORANGEPI-TEST-001']],
  'Dashboard Users': [['User ID']],
  'Metric Intervals': [['Timestamp start']],
  Demographics: [['Timestamp start']],
  System: [['Key','Value'],['demographics_enabled','false']]
};
const sheet = name => ({
  getLastRow:()=>sheets[name].length,
  getLastColumn:()=>Math.max(...sheets[name].map(r=>r.length)),
  getRange:(r,c,n,w)=>({
    getValues:()=>sheets[name].slice(r-1,r-1+n).map(row=>Array.from({length:w},(_,i)=>row[c-1+i] ?? '')),
    setValues:values=>{ for(let i=0;i<values.length;i++) sheets[name][r-1+i]=values[i]; }
  })
});
const zoneParts = date => {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'long'}).formatToParts(date);
  return Object.fromEntries(parts.map(p=>[p.type,p.value]));
};
const context = vm.createContext({
  Date,JSON,Math,String,Number,Array,Object,console,
  ContentService:{MimeType:{JSON:'json'},createTextOutput:content=>({content,setMimeType(){return this;}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},
  SpreadsheetApp:{openById:id=>{assert.equal(id,'test-book');return {getSheetByName:sheet};}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  Utilities:{formatDate:(date,_tz,pattern)=>{const p=zoneParts(date);return pattern==='yyyy-MM-dd|HH|EEEE|w'?`${p.year}-${p.month}-${p.day}|${p.hour}|${p.weekday}|37`:
    pattern==='yyyy-MM-dd'?`${p.year}-${p.month}-${p.day}`:
    pattern==='yyyy'?p.year:pattern==='HH'?p.hour:pattern==='EEEE'?p.weekday:pattern==='w'?'37':pattern==='Z'?'+0200':`${p.year}-${p.month}-${p.day}`;}}
});
vm.runInContext(code,context);
const call = body => JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}}).content);

test('Apps Script denies requests without the server token and arbitrary IDs',()=>{
  assert.equal(call({action:'getDashboardMetrics',authorizedBusinessId:'TM-TEST-001',authorizedLocationId:'TM-LOC-TEST-001'}).error.code,'UNAUTHORIZED');
  assert.equal(call({action:'getDashboardMetrics',serverToken:'script-secret',authorizedBusinessId:'other',authorizedLocationId:'TM-LOC-TEST-001'}).error.code,'LOCATION_NOT_AUTHORIZED');
});
test('Apps Script ingests aggregate batch once, computes weighted metrics, keeps demographics off',()=>{
  const start=new Date(Date.now()-15*60000),end=new Date(start.getTime()+5*60000);
  const body={action:'ingestMetrics',serverToken:'script-secret',businessId:'TM-TEST-001',locationId:'TM-LOC-TEST-001',deviceId:'ORANGEPI-TEST-001',requestId:'unit-test-1',
    intervals:[{start:start.toISOString(),end:end.toISOString(),passersBy:12,looked:4,stopped:1,totalLookTimeSeconds:11.2,validLookEvents:4,ageBuckets:null,genderBuckets:null}]};
  assert.equal(call(body).data.accepted,1);
  assert.equal(call(body).data.duplicates,1);
  assert.equal(sheets['Metric Intervals'].length,2);
  const metrics=call({action:'getDashboardMetrics',serverToken:'script-secret',authorizedBusinessId:'TM-TEST-001',authorizedLocationId:'TM-LOC-TEST-001',period:'7d'});
  assert.equal(metrics.ok,true);
  assert.equal(metrics.data.totals.passers,12);
  assert.equal(metrics.data.totals.looked,4);
  assert.equal(metrics.data.totals.stopRate,100/12);
  assert.equal(metrics.data.demographics.enabled,false);
  assert.equal(metrics.data.dataStatus,'REAL');
  assert.equal(call({...body,requestId:'=SUM(A1:A2)'}).error.code,'INVALID_IDENTIFIER');
});

const userHash=crypto.createHash('sha256').update('target.test').digest('hex');
const passwordHash=crypto.createHash('sha256').update('UnitTestOnly-NotARealCredential!').digest('hex');
const serverCode=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
let requestHandler,scriptCall;
const env={APPS_SCRIPT_URL:'https://old.example/exec',SERVER_TOKEN:'old-secret',MONITOR_APPS_SCRIPT_URL:'https://monitor.example/exec',
  MONITOR_SERVER_TOKEN:'script-secret',MONITOR_TEST_USER_HASH:userHash,MONITOR_TEST_PASSWORD_HASH:passwordHash,
  MONITOR_TEST_BUSINESS_ID:'TM-TEST-001',MONITOR_TEST_LOCATION_ID:'TM-LOC-TEST-001'};
const fakeHttp={createServer:handler=>{requestHandler=handler;return {listen:(_port,_host,cb)=>cb()};}};
const serverContext=vm.createContext({
  require:name=>name==='node:http'?fakeHttp:require(name),process:{env},console:{log(){},error(){}},
  Buffer,URL,Map,Set,Number,String,Date,JSON,Object,Promise,
  setInterval:()=>({unref(){}}),fetch:async (url,opts)=>{scriptCall={url,body:JSON.parse(opts.body),timeoutMs:opts.signal.ms};return {ok:true,text:async()=>JSON.stringify({ok:true,data:{dataStatus:'EMPTY'}})};},
  AbortSignal:{timeout:ms=>({ms})}
});
vm.runInContext(serverCode,serverContext);
async function invoke(method,url,body,token) {
  const req=new EventEmitter();req.method=method;req.url=url;req.headers={origin:'https://targetai1920-debug.github.io',...(token?{authorization:'Bearer '+token}:{})};req.socket={remoteAddress:'test-ip'};
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};
  const pending=requestHandler(req,res);
  if(method==='POST') {req.emit('data',Buffer.from(JSON.stringify(body||{})));req.emit('end');}
  await pending;
  return {status:res.statusCode,data:res.body?JSON.parse(res.body):null};
}
test('Render test login maps session to server-side business/location and leaves Applications token isolated',async()=>{
  const login=await invoke('POST','/api/dashboard/login',{username:'target.test',password:'UnitTestOnly-NotARealCredential!'});
  assert.equal(login.status,200);
  assert.match(login.data.token,/^[a-f0-9]{64}$/);
  const noSession=await invoke('GET','/api/dashboard/metrics?period=7d');
  assert.equal(noSession.status,401);
  const metrics=await invoke('GET','/api/dashboard/metrics?period=7d&businessId=attacker',null,login.data.token);
  assert.equal(metrics.status,200);
  assert.equal(scriptCall.url,'https://monitor.example/exec');
  assert.equal(scriptCall.body.authorizedBusinessId,'TM-TEST-001');
  assert.equal(scriptCall.body.authorizedLocationId,'TM-LOC-TEST-001');
  assert.equal(scriptCall.body.serverToken,'script-secret');
  assert.equal(scriptCall.timeoutMs,60000);
  const application=await invoke('POST','/api/applications',{fullName:'Test',businessName:'Shop',workEmail:'test@example.com'});
  assert.equal(application.status,201);
  assert.equal(scriptCall.url,'https://old.example/exec');
  assert.equal(scriptCall.body.serverToken,'old-secret');
  assert.equal(scriptCall.timeoutMs,15000);
});

test('dashboard consumes authorized aggregate response without browser-supplied business ID',async()=>{
  const elements=new Map(),calls=[];
  function element(id) {
    if(!elements.has(id)) elements.set(id,{textContent:'',value:'',hidden:false,style:{},innerHTML:'',dataset:{},
      classList:{toggle(){}},setAttribute(){},addEventListener(name,handler){this[name]=handler;},focus(){},select(){}});
    return elements.get(id);
  }
  const storage=new Map();
  const raw={dataStatus:'SAMPLE/TEST',sample:true,city:'Rotterdam',businessName:'Test storefront',observedDays:7,periodDays:7,
    totals:{passers:120,looked:42,stopped:12,lookRate:35,stopRate:10,avgLookTimeSeconds:2.8,intervalCount:7},
    previous:{passers:100,lookRate:32,stopRate:9},moments:{bestWindow:'18:00–19:00',weakWindow:'09:00–10:00',bestDay:'Friday'},
    trends:{hourly:[{label:'09',value:10},{label:'18',value:28}],daily:[{label:'2026-09-15',value:120}],weekly:[{label:'2026-W37',value:120}]},
    comparisons:{daily:{days:1,current:{passers:30,lookRate:35,stopRate:10},previous:{passers:20,lookRate:32,stopRate:9}},
      weekly:{days:7,current:{passers:120,lookRate:35,stopRate:10},previous:{passers:100,lookRate:32,stopRate:9}},
      monthly:{days:30,current:{passers:120,lookRate:35,stopRate:10},previous:{passers:100,lookRate:32,stopRate:9}}},
    demographics:{enabled:false,age:[],gender:[]},quarterly:{from:'2026-07-01T00:00:00Z',to:'2026-09-16T00:00:00Z',intervalCount:7,
      totals:{passers:120,lookRate:35,stopRate:10,intervalCount:7}}};
  const ui=vm.createContext({document:{getElementById:element,querySelectorAll:()=>[]},window:{scrollTo(){}},
    sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
    fetch:async (url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>url.endsWith('/api/dashboard/login')?{ok:true,token:'a'.repeat(64)}:{ok:true,data:raw}};},
    Intl,Number,Math,Map,Set,Date,JSON,String,Array,performance:{now:()=>0},requestAnimationFrame:cb=>cb(1000),
    AbortSignal,encodeURIComponent});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','dashboard.js'),'utf8'),ui);
  element('dashboardUser').value='target.test';element('dashboardPassword').value='UnitTestOnly-NotARealCredential!';
  await element('dashboardLogin').submit({preventDefault(){}});
  assert.equal(element('kpiLookRate').textContent,'35.0%');
  assert.equal(element('kpiPassers').textContent,'120');
  assert.equal(element('demographicStatus').textContent,'Disabled');
  assert.equal(element('quarterTraffic').textContent,'120');
  assert.match(element('dataStatus').textContent,/SAMPLE\/TEST/);
  assert.equal(calls[1].url,'https://target-media.onrender.com/api/dashboard/metrics?period=7d');
  assert.equal(calls[1].opts.headers.Authorization,'Bearer '+'a'.repeat(64));
  assert.doesNotMatch(calls[1].url,/businessId|locationId/);
});
