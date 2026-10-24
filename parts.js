(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MoveMixParts=api;})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const endpoints=['https://api.bilibili.com/x/web-interface/view','https://api.bilibili.com/x/player/pagelist'];
 function validPage(value){return /^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0;}
 function readMetadata(body){
  if(body?.code!==0)throw Error('metadata unavailable');
  const data=body.data,raw=Array.isArray(data)?data:data?.pages;
  if(!Array.isArray(raw)||!raw.length)throw Error('no pages');
  const seen=new Set(),pages=raw.map(item=>{
   if(!validPage(item.page)||!validPage(item.cid)||seen.has(Number(item.page)))throw Error('invalid pages');
   seen.add(Number(item.page));return {page:Number(item.page),cid:Number(item.cid),title:typeof item.part==='string'?item.part.slice(0,500):''};
  }).sort((a,b)=>a.page-b.page);
  return {videoTitle:typeof data?.title==='string'?data.title.slice(0,500):'',pages};
 }
 function createLoader(fetcher=(...args)=>fetch(...args),timeout=4500){
  const cache=new Map();
  return async function load(video){
   if(video.platform!=='Bilibili'||video.shortUrl)return video;
   const key=video.aid?'aid:'+video.aid:video.id;let entry=cache.get(key);
   if(!entry||entry.expires<Date.now()){
    entry={expires:Infinity};cache.set(key,entry);
    entry.promise=(async()=>{
     for(const endpoint of endpoints){
      const controller=new AbortController(),alarm=setTimeout(()=>controller.abort(),timeout);
      try{
       const url=new URL(endpoint);url.searchParams.set(video.aid?'aid':'bvid',video.aid||video.id);
       const response=await fetcher(url.href,{mode:'cors',credentials:'omit',signal:controller.signal});
       if(!response.ok)throw Error('HTTP '+response.status);
       const metadata=readMetadata(await response.json());entry.expires=Date.now()+600000;return {...metadata,metadataEndpoint:endpoint,metadataStatus:'ready'};
      }catch{}finally{clearTimeout(alarm);}
     }
     entry.expires=Date.now()+30000;return {pages:[],metadataStatus:'failed'};
    })();
   }
   const metadata=await entry.promise;
   return {...video,...metadata,p:validPage(video.p)?Number(video.p):1};
  };
 }
 function selectPage(core,video,page){
  if(!validPage(page))throw Error('请输入大于0的分P整数编号。');
  const p=Number(page),part=video.pages?.find(item=>item.page===p),next={...video,p};
  next.sourceKey=core.sourceKey(next);
  if(video.videoTitle)next.title=video.videoTitle+(video.pages.length>1?' · '+(part?.title||'P'+p):'');else{next.baseTitle=video.baseTitle||video.title||video.id;next.title=next.baseTitle+' · P'+p;}
  return next;
 }
 function parsePages(text){
  const normalized=String(text).trim().replace(/[，、]/g,',').replace(/[～〜]/g,'~').replace(/[–—]/g,'-').replace(/\s*([~-])\s*/g,'$1');
  if(!normalized)throw Error('请选择至少一个分P。');
  const pages=new Set();
  for(const token of normalized.split(/[,\s]+/).filter(Boolean)){
   const range=token.match(/^(\d+)[~-](\d+)$/),single=/^\d+$/.test(token);
   if(!range&&!single)throw Error('请按 1,2,3 或 1~3 填写。');
   const from=Number(range?range[1]:token),to=Number(range?range[2]:token);
   if(!validPage(from)||!validPage(to)||to<from)throw Error('分P从1开始，范围请从小到大填写。');
   if(to-from>=100)throw Error('每个队列最多100项，请分批选择。');
   for(let p=from;p<=to;p++){pages.add(p);if(pages.size>100)throw Error('每个队列最多100项，请分批选择。');}
  }
  if(!pages.size)throw Error('请选择至少一个分P。');
  return [...pages].sort((a,b)=>a-b);
 }
 function expandQueue(core,entries){
  const queue=[],seen=new Set();
  for(const [importIndex,entry] of entries.entries()){
   const video=entry.video,selected=video.platform==='Bilibili'&&!video.shortUrl?entry.selectedPages:[null];
   for(const page of selected){const item=page===null?{...video}:selectPage(core,video,page);item.importIndex=importIndex;
    if(page!==null)item.partTitle=video.pages?.find(p=>p.page===page)?.title||'';
    const key=core.sourceKey(item);if(seen.has(key))continue;seen.add(key);queue.push(item);
    if(queue.length>100)throw Error('每个队列最多100项，请分批选择。');
   }
  }
  if(!queue.length)throw Error('请选择至少一个视频或分P。');return queue;
 }
 function createController(core,onSessionSelect){
  const $=id=>document.getElementById(id),load=createLoader(),states={},savedKey='move-mix-cn:parts:v1';let saved={};
  try{saved=JSON.parse(localStorage.getItem(savedKey)||'{}')||{};}catch{}
  const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  function persist(){saved=Object.fromEntries(Object.entries(states).map(([role,state])=>[role,{input:state.input,selections:state.entries.map(e=>e.selectedPages)}]));try{localStorage.setItem(savedKey,JSON.stringify(saved));}catch{}}
  function sessionControl(video,label,change){
   const box=node('div');box.className='part-picker';if(video.platform!=='Bilibili')return box;
   if(video.videoTitle)box.append(node('p','《'+video.videoTitle+'》'));
   const available=video.pages?.length;if(available===1&&video.p===video.pages[0].page)return box;
   const wrapper=node('label',label+' · 选择分P'),field=node(available?'select':'input'),error=node('small');field.setAttribute('aria-label',label+'分P');error.className='error';
   if(available){for(const part of video.pages){const option=node('option','P'+part.page+(part.title?' · '+part.title:''));option.value=String(part.page);field.append(option);}if(!video.pages.some(p=>p.page===video.p)){const option=node('option','P'+video.p);option.value=String(video.p);field.append(option);}}
   else{field.type='number';field.min='1';field.step='1';field.inputMode='numeric';}field.value=String(video.p||1);
   field.onchange=()=>{try{change(selectPage(core,video,field.value));}catch(e){error.textContent=e.message;}};wrapper.append(field);box.append(wrapper,error);return box;
  }
  function render(role){
   const state=states[role],host=$(role+'Parts');host.replaceChildren();if(!state)return;
   state.entries.forEach((entry,index)=>{
    const video=entry.video;if(video.platform!=='Bilibili')return;
    const label=(role==='workout'?'锻炼':'娱乐')+(state.entries.length>1?'第'+(index+1)+'项':''),box=node('div');box.className='part-picker';
    if(video.title||video.videoTitle)box.append(node('p',video.videoTitle||video.title));
    if(video.shortUrl){box.append(node('small','可打开短链，复制视频号后继续。'));host.append(box);return;}
    if(video.metadataStatus==='loading'){box.append(node('small','正在准备分P…'));host.append(box);return;}
    if(video.pages?.length===1&&entry.selectedPages.length===1&&entry.selectedPages[0]===video.pages[0].page)return;
    const heading=node('p','想看哪些分P？'),error=node('small'),summary=node('small');error.className='error';error.setAttribute('role','status');
    const report=()=>{summary.textContent=entry.selectedPages.length?'已选 '+entry.selectedPages.map(p=>'P'+p).join('、'):'';};report();box.append(heading);
    if(video.pages?.length){
     const list=node('div');list.className='part-checklist';list.setAttribute('role','group');list.setAttribute('aria-label',label+'分P');
     // Include an explicit URL page even if the endpoint omitted it.
     const options=[...video.pages];for(const p of entry.selectedPages)if(!options.some(x=>x.page===p))options.push({page:p,title:''});options.sort((a,b)=>a.page-b.page);
     for(const part of options){const row=node('label'),check=node('input');check.type='checkbox';check.value=String(part.page);check.checked=entry.selectedPages.includes(part.page);check.setAttribute('aria-label',label+' P'+part.page);check.onchange=()=>{entry.selectedPages=check.checked?[...new Set([...entry.selectedPages,part.page])].sort((a,b)=>a-b):entry.selectedPages.filter(p=>p!==part.page);entry.draft=entry.selectedPages.join(',');persist();report();};row.append(check,node('span','P'+part.page+(part.title?' · '+part.title:'')));list.append(row);}box.append(list);
     const all=node('button','全选');all.type='button';all.onclick=()=>{try{entry.selectedPages=parsePages(options.map(p=>p.page).join(','));entry.draft=entry.selectedPages.join(',');persist();render(role);}catch(e){error.textContent=e.message;}};box.append(all);
    }else{
     const wrapper=node('label'),field=node('input');field.type='text';field.placeholder='例如：1,2,3 或 1~3';field.value=entry.draft;field.setAttribute('aria-label',label+'想看的分P');field.oninput=()=>{entry.draft=field.value;};wrapper.append(field);box.append(wrapper,node('small','可一次选择多个'));
    }
    const apply=node('button','加入队列');apply.type='button';apply.onclick=()=>{try{entry.selectedPages=parsePages(entry.draft);expandQueue(core,state.entries);persist();report();summary.textContent+=' · 已加入队列';error.textContent='';}catch(e){error.textContent=e.message;}};box.append(apply,summary,error);host.append(box);
   });
  }
  function refresh(role,input){
   if(states[role]?.input===input)return;
   let videos=[];try{videos=core.parseImport(input);}catch{}
   const restored=saved[role]?.input===input?saved[role]:{},entries=[];
   for(const video of videos){const previous=video.platform==='Bilibili'&&!video.shortUrl?entries.find(e=>e.video.platform===video.platform&&e.video.id===video.id):null;if(previous){previous.selectedPages=[...new Set([...previous.selectedPages,video.p])].sort((a,b)=>a-b);previous.draft=previous.selectedPages.join(',');continue;}const index=entries.length,stored=restored.selections?.[index]||[restored.pages?.[index]||video.p||1];let selectedPages;try{selectedPages=parsePages(stored.join(','));}catch{selectedPages=[video.p||1];}entries.push({video:video.platform==='Bilibili'&&!video.shortUrl?{...video,metadataStatus:'loading'}:video,selectedPages,draft:selectedPages.join(',')});}
   const state={input,entries};states[role]=state;render(role);
   state.ready=Promise.all(entries.map(async entry=>{try{const enriched=await load(await core.resolveVideo(entry.video));if(states[role]!==state)return;const wasShort=entry.video.shortUrl;entry.video=enriched;if(wasShort){entry.selectedPages=[enriched.p||1];entry.draft=entry.selectedPages.join(',');}render(role);}catch{if(states[role]===state){entry.video={...entry.video,metadataStatus:'failed'};render(role);}}}));
  }
  async function prepare(role,input){
   core.parseImport(input);refresh(role,input);const state=states[role];await state.ready;if(states[role]!==state)throw Error('输入已改变，请再次点击开始。');
   for(const entry of state.entries){entry.video=await core.resolveVideo(entry.video);if(entry.video.platform==='Bilibili')entry.selectedPages=parsePages(entry.draft);}
   const queue=expandQueue(core,state.entries);persist();return queue;
  }
  function session(role,video){const host=$(role+'SessionParts');host.replaceChildren();host.append(sessionControl(video,role==='workout'?'锻炼':'娱乐',next=>{const entry=states[role]?.entries[video.importIndex];if(entry&&entry.video.id===video.id&&!entry.selectedPages.includes(next.p)){entry.selectedPages.push(next.p);entry.selectedPages.sort((a,b)=>a-b);entry.draft=entry.selectedPages.join(',');persist();render(role);}onSessionSelect(role,next);}));}
  return {refresh,prepare,session};
 }
 return {endpoints,validPage,readMetadata,createLoader,selectPage,parsePages,expandQueue,createController};
});
