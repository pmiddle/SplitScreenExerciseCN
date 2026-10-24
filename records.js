(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MoveMixRecords=api;})(typeof window==='undefined'?this:window,function(){
'use strict';
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00');return !Number.isNaN(date.getTime())&&localDate(date)===value;}
function progressTime(seconds){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;}
function entertainmentSnapshot(video,adapter,sessionId,now=new Date()){
 if(!video||!sessionId)return null;
 let id=video.id,title=(video.platform==='Bilibili'?(video.videoTitle||video.baseTitle||video.title):(video.title||video.videoTitle))||'',currentTime;
 if(video.platform==='YouTube'&&adapter?.ready){
  try{const data=adapter.player?.getVideoData?.();if(typeof data?.title==='string'&&data.title.trim())title=data.title;if(/^[\w-]{11}$/.test(data?.video_id||''))id=data.video_id;else{const url=adapter.player?.getVideoUrl?.();if(url){const candidate=new URL(url).searchParams.get('v');if(/^[\w-]{11}$/.test(candidate||''))id=candidate;}}}catch{}
  if(adapter.capabilities?.canGetCurrentTime&&/^[\w-]{11}$/.test(id||''))try{const time=adapter.getCurrentTime();if(typeof time==='number'&&Number.isFinite(time)&&time>=0)currentTime=time;}catch{}
 }
 const snapshot={sessionId,platform:video.platform,id:id||video.playlistId||'',title:title||(video.platform==='YouTube'?'YouTube 视频':'B站视频')+' · '+(id||video.playlistId||''),timestamp:now.toISOString(),date:localDate(now)};
 if(video.platform==='Bilibili'){snapshot.p=Number.isSafeInteger(video.p)&&video.p>0?video.p:1;snapshot.sourceKey=`bilibili:${snapshot.id}:p${snapshot.p}`;}
 else{snapshot.sourceKey='youtube:'+snapshot.id;if(currentTime!==undefined)snapshot.currentTime=currentTime;}
 return snapshot;
}
function normalizeViewing(item){
 if(!item||!['Bilibili','YouTube'].includes(item.platform)||typeof item.id!=='string'||typeof item.title!=='string'||typeof item.sessionId!=='string'||!validDate(item.date)||!Number.isFinite(Date.parse(item.timestamp)))return null;
 const clean={sessionId:item.sessionId,platform:item.platform,id:item.id,title:item.title.slice(0,500),timestamp:item.timestamp,date:item.date};
 if(item.platform==='Bilibili'){clean.p=Number.isSafeInteger(item.p)&&item.p>0?item.p:1;clean.sourceKey=`bilibili:${clean.id}:p${clean.p}`;}
 else{clean.sourceKey='youtube:'+clean.id;if(typeof item.currentTime==='number'&&Number.isFinite(item.currentTime)&&item.currentTime>=0)clean.currentTime=item.currentTime;}
 return clean;
}
function csv(records,viewing=[]){
 const cell=value=>'"'+String(value??'').replace(/https?:\/\/[^\s<>"']+/gi,'').replace(/^\s*[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 const watchCells=w=>w?[w.platform,w.title,w.platform==='Bilibili'?'P'+w.p:'',w.platform==='YouTube'&&typeof w.currentTime==='number'?progressTime(w.currentTime):'']:['','','',''];
 const rows=[['日期','运动项目','锻炼平台','娱乐平台','娱乐视频','娱乐分P','娱乐观看进度']];
 const attached=new Set();
 for(const record of records){if(record.entertainment?.sessionId)attached.add(record.entertainment.sessionId);for(const item of record.items)rows.push([record.date,item.title,item.platform,...watchCells(record.entertainment)]);}
 for(const watch of viewing)if(!attached.has(watch.sessionId))rows.push([watch.date,'','',...watchCells(watch)]);
 return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
class Journal{
 constructor(storage){this.storage=storage;this.key='move-mix-cn:workout-records:v1';this.pendingKey='move-mix-cn:workout-pending:v1';this.viewingKey='move-mix-cn:entertainment-progress:v1';this.viewing=[];this.records=[];this.pending=[];this.failed=false;try{const records=JSON.parse(storage.getItem(this.key)||'[]'),pending=JSON.parse(storage.getItem(this.pendingKey)||'[]');if(Array.isArray(records))this.records=records.filter(r=>r&&validDate(r.date)&&typeof r.recordedAt==='string'&&Array.isArray(r.items)&&r.items.every(i=>i&&typeof i.title==='string'&&typeof i.url==='string'));if(Array.isArray(pending))this.pending=pending.filter(i=>i&&typeof i.title==='string'&&typeof i.url==='string');try{const viewing=JSON.parse(storage.getItem(this.viewingKey)||'[]');if(Array.isArray(viewing))this.viewing=viewing.map(normalizeViewing).filter(Boolean).slice(0,100);}catch{this.failed=true;}}catch{this.failed=true;}}
 persist(){try{this.storage.setItem(this.key,JSON.stringify(this.records));this.storage.setItem(this.pendingKey,JSON.stringify(this.pending));this.storage.setItem(this.viewingKey,JSON.stringify(this.viewing));this.failed=false;return true;}catch{this.failed=true;return false;}}
 updateEntertainment(snapshot){const next=normalizeViewing(snapshot);if(!next)return;const old=this.viewing.find(w=>w.sessionId===next.sessionId);if(old?.sourceKey===next.sourceKey&&next.platform==='YouTube'&&next.currentTime===undefined&&old.currentTime!==undefined)next.currentTime=old.currentTime;for(const record of this.records)if(record.entertainment?.sessionId===next.sessionId)record.entertainment={...next};this.viewing=[next,...this.viewing.filter(w=>w.sessionId!==next.sessionId)].slice(0,100);this.persist();return next;}
 select(items){this.pending=[...new Map(items.map(i=>[i.url,{...i}])).values()];this.persist();}
 add(date,urls){if(!validDate(date))throw Error('请选择有效的记录日期。');const items=this.pending.filter(i=>urls.includes(i.url));if(!items.length)throw Error('请先勾选实际完成的运动。');const record={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),date,recordedAt:new Date().toISOString(),items:items.map(i=>({...i}))};const watch=this.viewing.find(w=>w.sessionId===items[0].sessionId);if(watch)record.entertainment={...watch};this.records.unshift(record);this.pending=this.pending.filter(i=>!urls.includes(i.url));this.persist();return record;}
}
return {localDate,validDate,progressTime,entertainmentSnapshot,normalizeViewing,csv,Journal};
});
