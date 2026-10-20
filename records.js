(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MoveMixRecords=api;})(typeof window==='undefined'?this:window,function(){
'use strict';
const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T12:00:00');return !Number.isNaN(date.getTime())&&localDate(date)===value;}
function csv(records){const cell=value=>'"'+String(value).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';return '\ufeff'+[['日期','运动项目','平台','视频链接'],...records.flatMap(record=>record.items.map(item=>[record.date,item.title,item.platform,item.url]))].map(row=>row.map(cell).join(',')).join('\r\n');}
class Journal{
 constructor(storage){this.storage=storage;this.key='move-mix-cn:workout-records:v1';this.pendingKey='move-mix-cn:workout-pending:v1';this.records=[];this.pending=[];this.failed=false;try{const records=JSON.parse(storage.getItem(this.key)||'[]'),pending=JSON.parse(storage.getItem(this.pendingKey)||'[]');if(Array.isArray(records))this.records=records.filter(r=>r&&validDate(r.date)&&typeof r.recordedAt==='string'&&Array.isArray(r.items)&&r.items.every(i=>i&&typeof i.title==='string'&&typeof i.url==='string'));if(Array.isArray(pending))this.pending=pending.filter(i=>i&&typeof i.title==='string'&&typeof i.url==='string');}catch{this.failed=true;}}
 persist(){try{this.storage.setItem(this.key,JSON.stringify(this.records));this.storage.setItem(this.pendingKey,JSON.stringify(this.pending));this.failed=false;return true;}catch{this.failed=true;return false;}}
 select(items){this.pending=[...new Map(items.map(i=>[i.url,{...i}])).values()];this.persist();}
 add(date,urls){if(!validDate(date))throw Error('请选择有效的记录日期。');const items=this.pending.filter(i=>urls.includes(i.url));if(!items.length)throw Error('请先勾选实际完成的运动。');const record={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),date,recordedAt:new Date().toISOString(),items:items.map(i=>({...i}))};this.records.unshift(record);this.pending=this.pending.filter(i=>!urls.includes(i.url));this.persist();return record;}
}
return {localDate,validDate,csv,Journal};
});
