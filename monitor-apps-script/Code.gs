/* Target Media Monitor — bound to its separate metrics workbook. No secrets in source. */
var MONITOR_SCHEMA = '1';
var MONITOR_MAX_BATCH = 48;
var MONITOR_TABS = {businesses:'Businesses',users:'Dashboard Users',intervals:'Metric Intervals',demographics:'Demographics',system:'System'};

function monitorReply_(ok, data, code) {
  return ContentService.createTextOutput(JSON.stringify(ok ? {ok:true,data:data || {}} : {ok:false,error:{code:code || 'INTERNAL_ERROR'}}))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  if (e && e.parameter && e.parameter.action && e.parameter.action !== 'health') return monitorReply_(false,null,'METHOD_NOT_ALLOWED');
  return monitorReply_(true,{service:'target-media-monitor',schemaVersion:MONITOR_SCHEMA});
}
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 120000) throw monitorError_('INVALID_BODY');
    var body=JSON.parse(e.postData.contents);
    if (!body || Array.isArray(body) || typeof body !== 'object') throw monitorError_('INVALID_BODY');
    var token=PropertiesService.getScriptProperties().getProperty('MONITOR_SERVER_TOKEN');
    if (!token || typeof body.serverToken !== 'string' || !monitorEqual_(body.serverToken,token)) throw monitorError_('UNAUTHORIZED');
    var data;
    switch(body.action) {
      case 'health': data={service:'target-media-monitor',schemaVersion:MONITOR_SCHEMA}; break;
      case 'ingestMetrics': data=monitorIngest_(body); break;
      case 'getDashboardMetrics': data=monitorDashboard_(body); break;
      case 'diagnostics': data=monitorDiagnostics_(); break;
      default: throw monitorError_('UNKNOWN_ACTION');
    }
    return monitorReply_(true,data);
  } catch(err) {
    console.error('Monitor request failed: '+(err.code || 'INTERNAL_ERROR'));
    return monitorReply_(false,null,err.code || 'INTERNAL_ERROR');
  }
}
function monitorError_(code) {var err=new Error(code);err.code=code;return err;}
function monitorEqual_(a,b) {
  if (a.length !== b.length) return false;
  var mismatch=0;for(var i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch === 0;
}
function monitorBook_() {
  var id=PropertiesService.getScriptProperties().getProperty('MONITOR_SPREADSHEET_ID');
  if (!id) throw monitorError_('NOT_CONFIGURED');
  return SpreadsheetApp.openById(id);
}
function monitorTz_() {return PropertiesService.getScriptProperties().getProperty('TIMEZONE') || 'Europe/Amsterdam';}
function monitorRows_(tab) {
  var sheet=monitorBook_().getSheetByName(tab);
  if (!sheet) throw monitorError_('SCHEMA_MISMATCH');
  var last=sheet.getLastRow();
  return last<2 ? [] : sheet.getRange(2,1,last-1,sheet.getLastColumn()).getValues();
}
function monitorSafe_(value,max) {
  if(typeof value !== 'string' || value.length>max || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) throw monitorError_('INVALID_IDENTIFIER');
  return value;
}
function monitorBusiness_(businessId,locationId,deviceId) {
  var rows=monitorRows_(MONITOR_TABS.businesses);
  for(var i=0;i<rows.length;i++) {
    var r=rows[i];
    if(r[0]===businessId && r[3]===locationId && r[9]===true && (!deviceId || r[11]===deviceId)) return r;
  }
  throw monitorError_('LOCATION_NOT_AUTHORIZED');
}
function monitorNumber_(value,max,integer) {
  if(typeof value !== 'number' || !isFinite(value) || value<0 || value>max || (integer && Math.floor(value)!==value)) throw monitorError_('INVALID_METRIC');
  return value;
}
function monitorDate_(value) {
  if(typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)) throw monitorError_('INVALID_TIMESTAMP');
  var d=new Date(value);if(isNaN(d.getTime())) throw monitorError_('INVALID_TIMESTAMP');return d;
}
function monitorDemographicsEnabled_() {
  return monitorRows_(MONITOR_TABS.system).some(function(r){return r[0]==='demographics_enabled' && String(r[1]).toLowerCase()==='true';});
}
function monitorIngest_(body) {
  var businessId=monitorSafe_(body.businessId,80),locationId=monitorSafe_(body.locationId,80),deviceId=monitorSafe_(body.deviceId,80);
  monitorBusiness_(businessId,locationId,deviceId);
  var requestId=monitorSafe_(body.requestId,100);
  if(!Array.isArray(body.intervals) || body.intervals.length<1 || body.intervals.length>MONITOR_MAX_BATCH) throw monitorError_('INVALID_BATCH');
  var now=Date.now(), normalized=[],demographics=[];
  for(var i=0;i<body.intervals.length;i++) {
    var item=body.intervals[i];if(!item || typeof item!=='object' || Array.isArray(item)) throw monitorError_('INVALID_INTERVAL');
    var start=monitorDate_(item.start),end=monitorDate_(item.end),duration=end.getTime()-start.getTime();
    if(duration<5*60000 || duration>60*60000 || start.getTime()>now+10*60000 || start.getTime()<now-180*86400000) throw monitorError_('INVALID_INTERVAL');
    var passers=monitorNumber_(item.passersBy,100000,true),looked=monitorNumber_(item.looked,100000,true),stopped=monitorNumber_(item.stopped,100000,true);
    var total=monitorNumber_(item.totalLookTimeSeconds,3600000,false),valid=monitorNumber_(item.validLookEvents,100000,true);
    if(looked>passers || stopped>passers || valid>looked || (valid===0 && total!==0) || (valid>0 && total/valid>duration/1000)) throw monitorError_('INVALID_METRIC');
    if(item.ageBuckets!=null || item.genderBuckets!=null) {
      if(!monitorDemographicsEnabled_()) throw monitorError_('DEMOGRAPHICS_DISABLED');
      if(!item.ageBuckets || !item.genderBuckets) throw monitorError_('INVALID_DEMOGRAPHICS');
      var age=['18_24','25_34','35_44','45_54','55_plus'].map(function(k){return monitorNumber_(item.ageBuckets[k],passers,true);});
      var gender=['women','men','unknown'].map(function(k){return monitorNumber_(item.genderBuckets[k],passers,true);});
      if(age.reduce(function(a,b){return a+b;},0)>passers || gender.reduce(function(a,b){return a+b;},0)>passers) throw monitorError_('INVALID_DEMOGRAPHICS');
      demographics.push({index:i,row:[start,end,businessId,locationId].concat(age,gender,[true,monitorSafe_(item.methodologyVersion,80),requestId+':'+i])});
    }
    normalized.push([start,end,businessId,locationId,deviceId,passers,looked,stopped,total,valid,valid ? total/valid : '',
      'EDGE',item.uptimePct==null ? '' : monitorNumber_(item.uptimePct,100,false),requestId+':'+i,new Date(), 'REAL',
      monitorSafe_(item.metricDefinitionVersion || 'v1-draft',80)]);
  }
  var lock=LockService.getScriptLock();if(!lock.tryLock(20000)) throw monitorError_('BUSY');
  try {
    var sheet=monitorBook_().getSheetByName(MONITOR_TABS.intervals),existing=monitorRows_(MONITOR_TABS.intervals);
    var keys={};existing.forEach(function(r){keys[String(r[13])]=r;});
    var fresh=[];for(var j=0;j<normalized.length;j++){
      var row=normalized[j],prior=keys[row[13]];
      if(prior){
        if(String(prior[2])!==businessId || String(prior[3])!==locationId || Number(prior[5])!==row[5] || Number(prior[6])!==row[6] || Number(prior[7])!==row[7]) throw monitorError_('REQUEST_ID_CONFLICT');
      } else fresh.push(row);
    }
    if(fresh.length) sheet.getRange(sheet.getLastRow()+1,1,fresh.length,17).setValues(fresh);
    var demo=monitorBook_().getSheetByName(MONITOR_TABS.demographics),demoFresh=demographics.filter(function(d){return !keys[requestId+':'+d.index];});
    if(demoFresh.length) demo.getRange(demo.getLastRow()+1,1,demoFresh.length,15).setValues(demoFresh.map(function(d){return d.row;}));
    return {accepted:fresh.length,duplicates:normalized.length-fresh.length,requestId:requestId};
  } finally {lock.releaseLock();}
}
function monitorPeriod_(key,now) {
  var tz=monitorTz_(),day=86400000;
  if(key==='7d') return {start:new Date(now.getTime()-7*day),end:now,days:7};
  if(key==='30d') return {start:new Date(now.getTime()-30*day),end:now,days:30};
  if(key==='quarter') {
    var local=Utilities.formatDate(now,tz,'yyyy-MM-dd').split('-').map(Number),month=Math.floor((local[1]-1)/3)*3+1;
    var offset=Utilities.formatDate(new Date(Date.UTC(local[0],month-1,1,12)),tz,'Z');
    var hours=Number(offset.slice(0,3)),minutes=Number(offset.slice(3));
    var start=new Date(Date.UTC(local[0],month-1,1)-hours*3600000-Math.sign(hours)*minutes*60000);
    return {start:start,end:now,days:Math.ceil((now-start)/day)};
  }
  throw monitorError_('INVALID_PERIOD');
}
function monitorReadIntervals_(businessId,locationId) {
  var rows=monitorRows_(MONITOR_TABS.intervals).filter(function(r){return r[2]===businessId && r[3]===locationId;});
  var real=rows.some(function(r){return String(r[15])!=='SAMPLE/TEST' && String(r[15])!=='SAMPLE';});
  return {sample:!real && rows.length>0,rows:rows.filter(function(r){return real ? String(r[15])!=='SAMPLE/TEST' && String(r[15])!=='SAMPLE' : true;})};
}
function monitorDateValue_(v) {var d=v instanceof Date ? v : new Date(v);return isNaN(d.getTime()) ? null : d;}
function monitorSlice_(rows,start,end) {
  return rows.filter(function(r){var d=monitorDateValue_(r[0]);return d && d>=start && d<end;});
}
function monitorTotals_(rows) {
  var sums={passers:0,looked:0,stopped:0,totalLookTimeSeconds:0,validLookEvents:0,intervalCount:rows.length};
  rows.forEach(function(r){sums.passers+=Number(r[5])||0;sums.looked+=Number(r[6])||0;sums.stopped+=Number(r[7])||0;sums.totalLookTimeSeconds+=Number(r[8])||0;sums.validLookEvents+=Number(r[9])||0;});
  sums.lookRate=sums.passers ? 100*sums.looked/sums.passers : null;
  sums.stopRate=sums.passers ? 100*sums.stopped/sums.passers : null;
  sums.avgLookTimeSeconds=sums.validLookEvents ? sums.totalLookTimeSeconds/sums.validLookEvents : null;
  return sums;
}
function monitorTrend_(rows,granularity) {
  var tz=monitorTz_(),buckets={},daysByHour={};
  rows.forEach(function(r){var d=monitorDateValue_(r[0]);if(!d)return;
    var day=Utilities.formatDate(d,tz,'yyyy-MM-dd'),hour=Utilities.formatDate(d,tz,'HH');
    var key=granularity==='hourly' ? hour : granularity==='daily' ? day : Utilities.formatDate(d,tz,'yyyy')+'-W'+Utilities.formatDate(d,tz,'w');
    buckets[key]=(buckets[key]||0)+(Number(r[5])||0);
    if(granularity==='hourly'){daysByHour[key]=daysByHour[key]||{};daysByHour[key][day]=true;}
  });
  return Object.keys(buckets).sort().map(function(k){return {label:k,value:granularity==='hourly' ? Math.round(buckets[k]/Object.keys(daysByHour[k]).length) : buckets[k]};});
}
function monitorMoments_(rows) {
  var hourly=monitorTrend_(rows,'hourly').filter(function(x){return x.value>0;}),tz=monitorTz_(),week={};
  rows.forEach(function(r){var d=monitorDateValue_(r[0]);if(!d)return;var name=Utilities.formatDate(d,tz,'EEEE'),day=Utilities.formatDate(d,tz,'yyyy-MM-dd');
    week[name]=week[name]||{total:0,days:{}};week[name].total+=Number(r[5])||0;week[name].days[day]=true;
  });
  var best=hourly.slice().sort(function(a,b){return b.value-a.value;})[0],weak=hourly.slice().sort(function(a,b){return a.value-b.value;})[0];
  var weekdays=Object.keys(week).map(function(k){return {name:k,avg:week[k].total/Object.keys(week[k].days).length};}).sort(function(a,b){return b.avg-a.avg;});
  function hourLabel(x){if(!x)return null;var h=Number(x.label);return x.label+':00–'+String((h+1)%24).padStart(2,'0')+':00';}
  return {bestWindow:hourLabel(best),weakWindow:hourLabel(weak),bestDay:weekdays.length ? weekdays[0].name : null};
}
function monitorComparison_(rows,now,days) {
  var span=days*86400000,previousEnd=new Date(now.getTime()-span);
  return {current:monitorTotals_(monitorSlice_(rows,previousEnd,now)),previous:monitorTotals_(monitorSlice_(rows,new Date(previousEnd.getTime()-span),previousEnd)),days:days};
}
function monitorDemographics_(businessId,locationId,start,end) {
  if(!monitorDemographicsEnabled_()) return {enabled:false,age:[],gender:[]};
  var rows=monitorSlice_(monitorRows_(MONITOR_TABS.demographics).filter(function(r){return r[2]===businessId && r[3]===locationId && r[12]===true;}),start,end);
  var age=['18–24','25–34','35–44','45–54','55+'],gender=['Women','Men','Unknown'];
  function mix(labels,base){var counts=labels.map(function(_,i){return rows.reduce(function(sum,r){return sum+(Number(r[base+i])||0);},0);}),total=counts.reduce(function(a,b){return a+b;},0);return labels.map(function(label,i){return {label:label,count:counts[i],percent:total ? 100*counts[i]/total : 0};});}
  return {enabled:true,hasData:rows.length>0,age:mix(age,4),gender:mix(gender,9)};
}
function monitorDashboard_(body) {
  // This identity is chosen by Render after server-side login, never by the browser.
  var businessId=monitorSafe_(body.authorizedBusinessId,80),locationId=monitorSafe_(body.authorizedLocationId,80);
  var business=monitorBusiness_(businessId,locationId,null),now=new Date(),period=monitorPeriod_(body.period || '7d',now);
  var source=monitorReadIntervals_(businessId,locationId),current=monitorSlice_(source.rows,period.start,period.end),totals=monitorTotals_(current);
  var previous=monitorTotals_(monitorSlice_(source.rows,new Date(period.start.getTime()-(period.end-period.start)),period.start));
  var currentDays={};current.forEach(function(r){var d=monitorDateValue_(r[0]);if(d)currentDays[Utilities.formatDate(d,monitorTz_(),'yyyy-MM-dd')]=true;});
  var quarter=monitorPeriod_('quarter',now),quarterRows=monitorSlice_(source.rows,quarter.start,quarter.end);
  return {businessName:String(business[2]),city:String(business[5]),timezone:String(business[7]||monitorTz_()),period:body.period||'7d',
    dataStatus:current.length ? (source.sample ? 'SAMPLE/TEST' : 'REAL') : 'EMPTY',sample:source.sample,
    from:period.start.toISOString(),to:period.end.toISOString(),observedDays:Object.keys(currentDays).length,periodDays:period.days,
    totals:totals,previous:previous,moments:monitorMoments_(current),
    trends:{hourly:monitorTrend_(current,'hourly'),daily:monitorTrend_(current,'daily'),weekly:monitorTrend_(current,'weekly')},
    comparisons:{daily:monitorComparison_(source.rows,now,1),weekly:monitorComparison_(source.rows,now,7),monthly:monitorComparison_(source.rows,now,30)},
    demographics:monitorDemographics_(businessId,locationId,period.start,period.end),
    quarterly:{from:quarter.start.toISOString(),to:quarter.end.toISOString(),totals:monitorTotals_(quarterRows),previous:monitorComparison_(source.rows,quarter.end,Math.ceil((quarter.end-quarter.start)/86400000)).previous,
      intervalCount:quarterRows.length,partial:true}};
}
function monitorDiagnostics_() {
  var props=PropertiesService.getScriptProperties();
  return {schemaVersion:MONITOR_SCHEMA,spreadsheetConfigured:!!props.getProperty('MONITOR_SPREADSHEET_ID'),tokenConfigured:!!props.getProperty('MONITOR_SERVER_TOKEN'),
    timezone:monitorTz_(),businessRows:monitorRows_(MONITOR_TABS.businesses).length,metricRows:monitorRows_(MONITOR_TABS.intervals).length,
    demographicsEnabled:monitorDemographicsEnabled_()};
}
function monitorSelfTest() {
  var t=monitorTotals_([[new Date(),null,null,null,null,12,4,1,11.2,4],[new Date(),null,null,null,null,8,2,1,4.8,2]]);
  if(t.passers!==20 || t.looked!==6 || t.stopped!==2 || t.lookRate!==30 || t.stopRate!==10 || Math.abs(t.avgLookTimeSeconds-16/6)>.0001) throw monitorError_('SELF_TEST_FAILED');
  if(!monitorEqual_('abc','abc') || monitorEqual_('abc','abd')) throw monitorError_('SELF_TEST_FAILED');
  console.log(JSON.stringify({ok:true,tests:['weighted rates','average duration','token compare']}));
  return true;
}
